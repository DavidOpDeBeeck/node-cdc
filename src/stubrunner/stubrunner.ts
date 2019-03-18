import { ArtifactRepository } from './../artifact/artifact.repository';
import { join } from "path";
import { sync } from "rimraf";
import { mkdirSync, createWriteStream } from "fs";
import { ArtifactDownloader } from "../artifact/artifact.downloader";
import { pipeAsync } from "../utils/stream";
import { Artifact } from "../artifact/artifact";
import { Parse, Entry } from "unzipper";
import * as etl from 'etl';
import { createRepository } from "../artifact/artifact.repository";
import { spawn, ChildProcess } from "child_process";
import { splitNewLines } from "../utils/utils";
import { logger, startupLogger, createBasicLogger } from "../utils/logger";
import { tmpdir } from 'os';

export interface StubRunnerOptions {
    consumerName?: string,
    wireMockArtifact?: string,
    artifactRepositories: string[]
}

export interface ContractPortMappings {
    [key: number]: string
}

export class StubRunner {

    private static WORKING_DIRECTORY = join(tmpdir(), 'node-cdc');
    private static WIRE_MOCK_FILE_PATH = join(StubRunner.WORKING_DIRECTORY, 'wiremock.jar');
    private static WIRE_MOCK_ARTIFACT_REFERENCE = 'com.github.tomakehurst:wiremock-standalone:2.21.0';

    private readonly consumerName: string;
    private readonly wireMockArtifact: Artifact;
    private readonly artifactRepositories: ArtifactRepository[];

    private wireMockProcesses: ChildProcess[] = [];
    private artifactDownloader: ArtifactDownloader;

    constructor(options: StubRunnerOptions) {
        this.consumerName = options.consumerName;
        this.wireMockArtifact = Artifact.from(options.wireMockArtifact || StubRunner.WIRE_MOCK_ARTIFACT_REFERENCE);
        this.artifactRepositories = options.artifactRepositories.map(createRepository);
        this.artifactDownloader = new ArtifactDownloader(this.artifactRepositories);
    }

    async start(mappings: ContractPortMappings): Promise<void> {
        try {
            this.cleanWorkingDirectory();
            await this.downloadWireMock();
            await this.downloadContracts(mappings);
            await this.startWireMockProcesses(mappings);
        } catch (e) {
            logger.error(e);
        }
    }

    stop(): void {
        try {
            this.stopWireMockProcesses();
        } catch (e) {
            logger.error(e);
        }
    }

    private cleanWorkingDirectory(): void {
        sync(StubRunner.WORKING_DIRECTORY);
        mkdirSync(StubRunner.WORKING_DIRECTORY);
    }

    private async downloadWireMock(): Promise<void> {
        return this.artifactDownloader.downloadArtifact(this.wireMockArtifact)
            .then(stream => pipeAsync(stream, createWriteStream(StubRunner.WIRE_MOCK_FILE_PATH)));
    }

    private async downloadContracts(mappings: ContractPortMappings): Promise<void> {
        for (const [port, artifactAsString] of Object.entries(mappings)) {
            const artifact = Artifact.from(artifactAsString);
            const extractionPath = join(StubRunner.WORKING_DIRECTORY, port);

            logger.info(`Downloading contracts for ${artifact}`);
            await this.downloadContract(artifact, extractionPath);
        }
    }

    private async downloadContract(contractArtifact: Artifact, extractionPath: string): Promise<void> {
        const extractor = new ContractExtractor(this.consumerName, extractionPath);

        return this.artifactDownloader.downloadArtifact(contractArtifact)
            .then(stream => stream.pipe(Parse())
                .pipe(etl.map((entry: Entry) => extractor.handleEntry(entry)))
                .promise());
    }

    private async startWireMockProcesses(mappings: ContractPortMappings): Promise<void> {
        for (const [port] of Object.entries(mappings)) {
            const process = await this.startWireMockProcess(parseInt(port));
            this.wireMockProcesses.push(process);
        }
    }

    private async startWireMockProcess(port: number): Promise<ChildProcess> {
        return new Promise((resolve) => {
            const logger = createBasicLogger(`StubRunner@${port}`);
            const process = spawn('java', ['-jar', 'wiremock.jar', '--root-dir', `${port}`, '--local-response-templating', '--port', `${port}`], { cwd: StubRunner.WORKING_DIRECTORY });
            process.stdout.on('data', data => splitNewLines(data.toString()).forEach(logger.info));
            process.stderr.on('data', data => splitNewLines(data.toString()).forEach(logger.error));
            process.stdout.on('data', data => data.indexOf('verbose:') >= 0 && resolve(process));
        });
    }

    private stopWireMockProcesses(): void {
        this.wireMockProcesses.forEach(process => process.kill('SIGINT'));
    }
}

class ContractExtractor {

    private readonly extractionPath: string;

    constructor(private consumerName: string, extractionBasePath: string) {
        this.extractionPath = this.createExtractionPath(extractionBasePath);
    }

    async handleEntry(entry: Entry): Promise<void> {
        if (this.isValidEntry(entry)) {
            const filename = this.extractFilename(entry);
            const filePath = join(this.extractionPath, filename);
            logger.info(`Found contract: ${filename}`);
            await pipeAsync(entry, createWriteStream(filePath));
            return;
        }

        await entry.autodrain();
    }

    private isValidEntry(entry: Entry): boolean {
        return this.hasJsonExtension(entry)
            && this.isFile(entry)
            && this.isInConsumerDirectory(entry);
    }

    private hasJsonExtension(entry: Entry): boolean {
        return entry.path.endsWith('.json');
    }

    private isFile(entry: Entry): boolean {
        return entry.type === 'File';
    }

    private isInConsumerDirectory(entry: Entry): boolean {
        const path = this.extractFilePath(entry);
        return this.consumerName === undefined
            || path.indexOf(this.consumerName) >= 0;
    }

    private extractFilename(entry: Entry): string {
        const path = entry.path;
        return path.substring(path.lastIndexOf('/'));
    }

    private extractFilePath(entry: Entry): string {
        const path = entry.path;
        return path.substring(0, path.lastIndexOf('/'));
    }

    private createExtractionPath(extractionBasePath: string): string {
        const extractionMappingsPath = join(extractionBasePath, `mappings`);
        mkdirSync(extractionBasePath);
        mkdirSync(extractionMappingsPath);
        return extractionMappingsPath;
    }
}