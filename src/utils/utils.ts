const NEWLINE_MATCHER: RegExp = /(.*)(\r\n|\n\r|\n|\r)/gm;

export function splitNewLines(text: string): string[] {
    return NEWLINE_MATCHER.test(text)
        ? text.match(NEWLINE_MATCHER).map(line => line.replace(NEWLINE_MATCHER, '$1'))
        : [text];
}