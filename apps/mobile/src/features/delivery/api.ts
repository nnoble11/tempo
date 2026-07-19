import {
  DeliveryEndpointListSchema,
  DeliveryEndpointSchema,
  RequestEndpointVerificationResultSchema,
  type DeliveryEndpoint,
  type RequestEndpointVerificationResult,
  type UpsertDeliveryEndpoint,
} from "@tempo/contracts";

import { authenticatedRequest } from "../../api/client";

export const upsertDeliveryEndpoint = async (
  input: UpsertDeliveryEndpoint,
): Promise<DeliveryEndpoint> => {
  const response = await authenticatedRequest("/v1/delivery-endpoints", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return DeliveryEndpointSchema.parse(await response.json());
};

export const fetchDeliveryEndpoints = async (): Promise<DeliveryEndpoint[]> => {
  const response = await authenticatedRequest("/v1/delivery-endpoints");
  return DeliveryEndpointListSchema.parse(await response.json()).items;
};

export const requestDeliveryEndpointVerification = async (
  endpointId: string,
): Promise<RequestEndpointVerificationResult> => {
  const response = await authenticatedRequest(
    `/v1/delivery-endpoints/${endpointId}/verification`,
    { method: "POST" },
  );
  return RequestEndpointVerificationResultSchema.parse(await response.json());
};

export const confirmDeliveryEndpointVerification = async (
  endpointId: string,
  code: string,
): Promise<DeliveryEndpoint> => {
  const response = await authenticatedRequest(
    `/v1/delivery-endpoints/${endpointId}/verification/confirm`,
    {
      method: "POST",
      body: JSON.stringify({ code }),
    },
  );
  return DeliveryEndpointSchema.parse(await response.json());
};

export const disableDeliveryEndpoint = async (
  endpointId: string,
): Promise<void> => {
  await authenticatedRequest(`/v1/delivery-endpoints/${endpointId}`, {
    method: "DELETE",
  });
};
