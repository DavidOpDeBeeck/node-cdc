import { Artifact } from "./artifact";
import { ArtifactRepository } from "./artifact.repository";
import { Readable } from "stream";

export class ArtifactDownloader {

    constructor(private repositories: ArtifactRepository[]) { }

    async downloadArtifact(artifact: Artifact): Promise<Readable> {
        return this.findRepositoryContainingArtifact(artifact)
            .then(repository => repository.download(artifact));
    }

    private async findRepositoryContainingArtifact(artifact: Artifact): Promise<ArtifactRepository> {
        return new Promise<ArtifactRepository>(async (resolve, reject) => {
            for (const repository of this.repositories) {
                if (await repository.exists(artifact)) {
                    resolve(repository);
                }
            }
            reject(`${artifact} could not be found in any of the declared repositories`);
        });
    }
}