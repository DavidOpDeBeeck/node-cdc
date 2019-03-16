import { join } from "path";

export class Artifact {

    static from(identifier: string): Artifact {
        const [groupId, artifactId, version, classifier] = identifier.split(':');
        return new Artifact(groupId, artifactId, version, classifier);
    }

    constructor(
        private groupId: string,
        private artifactId: string,
        private version: string,
        private classifier?: string
    ) { }

    get uri() {
        return join(
            this.groupId.replace(/\./g, '/'),
            this.artifactId.replace(/\./g, '/'),
            this.version,
            this.fileName
        );
    }

    get fileName(): string {
        return this.classifier
            ? `${this.artifactId}-${this.version}-${this.classifier}.jar`
            : `${this.artifactId}-${this.version}.jar`;
    }

    get identifier(): string {
        return this.classifier
            ? `'${this.groupId}:${this.artifactId}:${this.version}:${this.classifier}'`
            : `'${this.groupId}:${this.artifactId}:${this.version}'`;
    }

    toString(): string {
        return this.identifier;
    }
}