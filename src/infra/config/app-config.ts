export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];
  bodyJsonLimit: string;
  bodyUrlencodedLimit: string;
  databaseUrl: string;
  redisUrl: string;
  healthDatabaseTimeoutMs: number;
  healthRedisTimeoutMs: number;
}
