import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import util from 'util';
import stripAnsi from 'strip-ansi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const logFile = path.join(tempDir, 'app.log');

// Default config values
const defaultConfig = {
  logging: {
    level: 'debug',
    file: {
      maxSize: 5242880, // 5MB
      maxFiles: 5,
      format: {
        timestamp: 'YYYY-MM-DD HH:mm:ss',
        breakLength: 120
      }
    },
    console: {
      format: {
        timestamp: 'YYYY-MM-DD HH:mm:ss',
        breakLength: 120
      }
    }
  }
};

const formatMessage = (message, forConsole = false) => {
  if (typeof message === 'string') {
    const processedMessage = forConsole ? message : stripAnsi(message);
    if (processedMessage.includes('\n')) {
      return '\n' + processedMessage.split('\n').map(line => `  ${line}`).join('\n');
    }
    return processedMessage;
  }
  
  return util.inspect(message, {
    depth: null,
    colors: true,
    maxArrayLength: null,
    maxStringLength: null,
    breakLength: defaultConfig.logging.console.format.breakLength
  });
};

const createFormat = (forConsole = false) => winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let formattedMessage = message;
  
  if (metadata.splat) {
    formattedMessage = metadata.splat.reduce((msg, arg) => {
      const formattedArg = formatMessage(arg, forConsole);
      return `${msg}${formattedArg.startsWith('\n') ? '' : ' '}${formattedArg}`;
    }, formatMessage(message, forConsole));
  } else {
    formattedMessage = formatMessage(message, forConsole);
  }

  const finalMessage = forConsole ? formattedMessage : stripAnsi(formattedMessage);
  const header = `${timestamp} [${level.toUpperCase()}]:`;
  return `${header}${finalMessage.startsWith('\n') ? '' : ' '}${finalMessage}`;
});

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ 
    format: defaultConfig.logging.console.format.timestamp 
  }),
  winston.format.splat(),
  createFormat(true)
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ 
    format: defaultConfig.logging.file.format.timestamp 
  }),
  winston.format.splat(),
  createFormat(false)
);

const logger = winston.createLogger({
  level: defaultConfig.logging.level,
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new winston.transports.File({ 
      filename: logFile,
      format: fileFormat,
      maxsize: defaultConfig.logging.file.maxSize,
      maxFiles: defaultConfig.logging.file.maxFiles,
      tailable: true
    })
  ]
});

const enhancedLogger = {
  info: (...args) => logger.info(args[0], ...args.slice(1)),
  error: (...args) => logger.error(args[0], ...args.slice(1)),
  warn: (...args) => logger.warn(args[0], ...args.slice(1)),
  debug: (...args) => logger.debug(args[0], ...args.slice(1)),
  
  apiRequest: (endpoint, data) => {
    logger.info(`\n=== API REQUEST to ${endpoint} ===\n${formatMessage(data)}\n===================`);
  },
  
  apiResponse: (endpoint, data) => {
    logger.info(`\n=== API RESPONSE from ${endpoint} ===\n${formatMessage(data)}\n===================`);
  },
  
  section: (title, content) => {
    logger.info(`\n=== ${title} ===\n${formatMessage(content)}\n===================`);
  }
};

export default enhancedLogger; 