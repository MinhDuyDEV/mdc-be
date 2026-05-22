import { SetMetadata } from "@nestjs/common";

export const ENTITLEMENT_METADATA_KEY = Symbol("ENTITLEMENT_METADATA_KEY");

export const RequireEntitlement = (featureKey: string) =>
	SetMetadata(ENTITLEMENT_METADATA_KEY, featureKey);
