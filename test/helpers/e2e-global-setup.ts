import { writeFile } from 'node:fs/promises';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import {
  e2eTestcontainersStatePath,
  shouldUseE2eTestcontainers,
} from './e2e-testcontainers-state';

type ContainerFactory = () => GenericContainer;

interface ContainerDefinition {
  name: string;
  create: ContainerFactory;
}

const definitions: ContainerDefinition[] = [
  {
    name: 'postgres',
    create: () =>
      new GenericContainer('postgres:16-alpine')
        .withEnvironment({
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: 'postgres',
          POSTGRES_DB: 'mdc_test',
        })
        .withExposedPorts({ container: 5432, host: 5432 })
        .withWaitStrategy(
          Wait.forLogMessage(/database system is ready to accept connections/),
        )
        .withStartupTimeout(120_000),
  },
  {
    name: 'redis',
    create: () =>
      new GenericContainer('redis:7-alpine')
        .withExposedPorts({ container: 6379, host: 6379 })
        .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
        .withStartupTimeout(60_000),
  },
  {
    name: 'minio',
    create: () =>
      new GenericContainer('minio/minio:RELEASE.2025-04-22T22-12-26Z')
        .withEnvironment({
          MINIO_ROOT_USER: 'minioadmin',
          MINIO_ROOT_PASSWORD: 'minioadmin',
        })
        .withCommand(['server', '/data', '--console-address', ':9001'])
        .withExposedPorts(
          { container: 9000, host: 9000 },
          { container: 9001, host: 9001 },
        )
        .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
        .withStartupTimeout(120_000),
  },
  {
    name: 'elasticsearch',
    create: () =>
      new GenericContainer(
        'docker.elastic.co/elasticsearch/elasticsearch:8.17.0',
      )
        .withEnvironment({
          'discovery.type': 'single-node',
          'xpack.security.enabled': 'false',
          ES_JAVA_OPTS: '-Xms512m -Xmx512m',
        })
        .withExposedPorts({ container: 9200, host: 9200 })
        .withWaitStrategy(
          Wait.forHttp('/_cluster/health', 9200).forStatusCode(200),
        )
        .withStartupTimeout(180_000),
  },
  {
    name: 'mailhog',
    create: () =>
      new GenericContainer('mailhog/mailhog:v1.0.1')
        .withExposedPorts(
          { container: 1025, host: 1025 },
          { container: 8025, host: 8025 },
        )
        .withWaitStrategy(Wait.forListeningPorts())
        .withStartupTimeout(60_000),
  },
];

function applyContainerEnv(): void {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@localhost:5432/mdc_test?schema=public';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.S3_ENDPOINT = 'http://localhost:9000';
  process.env.S3_REGION = 'us-east-1';
  process.env.S3_ACCESS_KEY_ID = 'minioadmin';
  process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
  process.env.S3_BUCKET = 'mdc-test';
  process.env.S3_FORCE_PATH_STYLE = 'true';
  process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.SMTP_SECURE = 'false';
}

export default async function globalSetup(): Promise<void> {
  if (!shouldUseE2eTestcontainers()) {
    return;
  }

  applyContainerEnv();

  const started: StartedTestContainer[] = [];
  try {
    for (const definition of definitions) {
      const container = await definition.create().start();
      started.push(container);
    }

    await writeFile(
      e2eTestcontainersStatePath,
      JSON.stringify({
        containerIds: started.map((container) => container.getId()),
      }),
      'utf8',
    );
  } catch (err) {
    await Promise.allSettled(started.map((container) => container.stop()));
    throw err;
  }
}
