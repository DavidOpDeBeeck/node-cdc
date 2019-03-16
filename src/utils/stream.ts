import { Readable } from "stream";

export async function pipeAsync<T extends NodeJS.WritableStream>(source: Readable, destination: T): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        source.pipe(destination)
            .on('error', () => reject())
            .on('finish', () => resolve());
    });
}