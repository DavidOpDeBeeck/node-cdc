import { Format } from 'logform';
import { Logger, createLogger, transports, format } from 'winston';

const basicFormat = (label: string) => format.combine(
    format.label({ label: label }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`)
);

const startupFormat = format.combine(
    format.printf(info => info.message)
);

const colorizeFormat = (formatToColorize: Format) => {
    return format.combine(format.colorize({ all: true }), formatToColorize);
};

const createBasicLogger = (label: string) => {
    return createLogger({
        transports: [
            new transports.File({ filename: 'node-cdc.log', format: basicFormat(label) }),
            new transports.Console({ format: colorizeFormat(basicFormat(label)) })
        ]
    });
};

const createStartupLogger = () => {
    return createLogger({
        transports: [
            new transports.File({ filename: 'node-cdc.log', format: startupFormat }),
            new transports.Console({ format: colorizeFormat(startupFormat) })
        ]
    });
};

const startupLogger: Logger = createStartupLogger();
const logger: Logger = createBasicLogger('StubRunner');

export {
    logger,
    startupLogger,
    createBasicLogger
};