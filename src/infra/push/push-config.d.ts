// Declaration merging to extend AppConfig with push notification config.
// These fields must be added to src/infra/config/app-config.ts before production.
import 'src/infra/config/app-config';

declare module 'src/infra/config/app-config' {
  interface AppConfig {
    fcmEnabled: boolean;
    fcmServiceAccountPath: string;
    apnsEnabled: boolean;
    apnsTeamId: string;
    apnsKeyId: string;
    apnsSigningKeyPath: string;
    apnsBundleId: string;
    apnsProduction: boolean;
  }
}
