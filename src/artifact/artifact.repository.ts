import { Readable } from 'stream';
import { get } from "request";
import { createReadStream, exists } from 'fs';
import { homedir } from 'os';
import { Artifact } from './artifact';

export function createRepository(uri: string): ArtifactRepository {
    const uriWithSlash = uri.endsWith('/') ? uri : uri + '/';
    return uri.startsWith('http') ? new RemoteRepository(uriWithSlash) : new LocalRepository(uriWithSlash);
}

export interface ArtifactRepository {
    exists(artifact: Artifact): Promise<boolean>
    download(artifact: Artifact): Promise<Readable>
}

class RemoteRepository implements ArtifactRepository {

    constructor(private baseUrl: string) { }

    exists(artifact: Artifact): Promise<boolean> {
        return new Promise((resolve) => {
            get(this.baseUrl + artifact.uri)
                .on('error', () => resolve(false))
                .on('response', response => resolve(response.statusCode == 200));
        });
    }

    download(artifact: Artifact): Promise<Readable> {
        return new Promise((resolve, reject) => {
            get(this.baseUrl + artifact.uri)
                .on('error', error => reject(error))
                .on('response', response => resolve(response));
        });
    }

    toString(): string {
        return this.baseUrl;
    }
}

class LocalRepository implements ArtifactRepository {

    private rootPath: string;

    constructor(path: string) {
        this.rootPath = path.startsWith('~') ? path.replace('~', homedir()) : path;
    }

    exists(artifact: Artifact): Promise<boolean> {
        return new Promise((resolve) => {
            exists(this.rootPath + artifact.uri, exists => resolve(exists));
        });
    }

    download(artifact: Artifact): Promise<Readable> {
        return new Promise((resolve) => {
            resolve(createReadStream(this.rootPath + artifact.uri));
        });
    }

    toString(): string {
        return this.rootPath;
    }
}