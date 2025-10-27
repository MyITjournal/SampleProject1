import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels
const LOG_LEVELS = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG",
};

class ModuleLogger {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.logFile = path.join(logsDir, `${moduleName}.log`);
    this.errorFile = path.join(logsDir, `${moduleName}-error.log`);
  }

  // Format log message with timestamp and level
  formatMessage(level, message, extra = null) {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] [${this.moduleName}] ${message}`;

    if (extra) {
      return `${baseMessage} | Data: ${
        typeof extra === "object" ? JSON.stringify(extra, null, 2) : extra
      }`;
    }

    return baseMessage;
  }

  // Write to file (async)
  async writeToFile(filePath, message) {
    try {
      await fs.promises.appendFile(filePath, message + "\n");
    } catch (error) {
      console.error(`Failed to write to log file ${filePath}:`, error.message);
    }
  }

  // Write to file (sync - for critical errors)
  writeToFileSync(filePath, message) {
    try {
      fs.appendFileSync(filePath, message + "\n");
    } catch (error) {
      console.error(`Failed to write to log file ${filePath}:`, error.message);
    }
  }

  // Log methods
  async error(message, extra = null) {
    const formattedMessage = this.formatMessage(
      LOG_LEVELS.ERROR,
      message,
      extra
    );

    // Write to console (always show errors)
    console.error(`🔴 ${formattedMessage}`);

    // Write to both general log and error-specific log
    await this.writeToFile(this.logFile, formattedMessage);
    await this.writeToFile(this.errorFile, formattedMessage);
  }

  // Synchronous error logging for critical situations
  errorSync(message, extra = null) {
    const formattedMessage = this.formatMessage(
      LOG_LEVELS.ERROR,
      message,
      extra
    );

    console.error(`🔴 ${formattedMessage}`);
    this.writeToFileSync(this.logFile, formattedMessage);
    this.writeToFileSync(this.errorFile, formattedMessage);
  }

  async warn(message, extra = null) {
    const formattedMessage = this.formatMessage(
      LOG_LEVELS.WARN,
      message,
      extra
    );

    console.warn(`🟡 ${formattedMessage}`);
    await this.writeToFile(this.logFile, formattedMessage);
  }

  async info(message, extra = null) {
    const formattedMessage = this.formatMessage(
      LOG_LEVELS.INFO,
      message,
      extra
    );

    console.log(`🔵 ${formattedMessage}`);
    await this.writeToFile(this.logFile, formattedMessage);
  }

  async debug(message, extra = null) {
    const formattedMessage = this.formatMessage(
      LOG_LEVELS.DEBUG,
      message,
      extra
    );

    // Only show debug in development
    if (process.env.NODE_ENV !== "production") {
      console.log(`🟣 ${formattedMessage}`);
    }

    await this.writeToFile(this.logFile, formattedMessage);
  }

  // Success logging (special case)
  async success(message, extra = null) {
    const formattedMessage = this.formatMessage("SUCCESS", message, extra);

    console.log(`🟢 ${formattedMessage}`);
    await this.writeToFile(this.logFile, formattedMessage);
  }

  // Log API requests/responses
  async apiLog(method, url, statusCode, duration, extra = null) {
    const message = `${method} ${url} - ${statusCode} - ${duration}ms`;
    const formattedMessage = this.formatMessage("API", message, extra);

    console.log(`🌐 ${formattedMessage}`);
    await this.writeToFile(this.logFile, formattedMessage);
  }

  // Database operation logging
  async dbLog(operation, table, duration, rowCount = null, extra = null) {
    const message = `DB ${operation} on ${table} - ${duration}ms${
      rowCount ? ` (${rowCount} rows)` : ""
    }`;
    const formattedMessage = this.formatMessage("DATABASE", message, extra);

    console.log(`🗄️ ${formattedMessage}`);
    await this.writeToFile(this.logFile, formattedMessage);
  }
}

// Factory function to create logger for each module
export const createLogger = (moduleName) => {
  return new ModuleLogger(moduleName);
};

// Helper to auto-detect module name from file path
export const createLoggerFromPath = (importMetaUrl) => {
  const filePath = fileURLToPath(importMetaUrl);
  const moduleName = path.basename(path.dirname(filePath));
  return new ModuleLogger(moduleName);
};

export default createLogger;
