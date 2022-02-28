/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { UMRestApiRouteFactory } from './types';

const RECORDER_API_KEY_NAME = 'synthetics-recorder-api-key';

export const createApiKeyRoute: UMRestApiRouteFactory = () => ({
  method: 'GET',
  path: '/internal/uptime/api_key',
  validate: false,
  handler: async (args): Promise<any> => {
    const { context, request, server } = args;
    const { security } = server;
    if (!(await security.authc.apiKeys?.areAPIKeysEnabled())) {
      throw Error('API KEYS ARE NOT ENABLED');
    }
    if (!request) throw Error('SERVER REQUEST IS FALSEY');

    const getApiKeyResult =
      await context.core.elasticsearch.client.asCurrentUser.security.getApiKey();

    /**
     * TODO: the logic here needs improvement as it's extremely vulnerable
     * to name collisions. This code is not production-worthy as-is.
     */
    const apiKey = getApiKeyResult.api_keys.find(
      ({ name, invalidated }) => name === RECORDER_API_KEY_NAME && invalidated === false
    );
    if (apiKey) return apiKey;
    const apiKeyResult = await security.authc.apiKeys?.create(request, {
      name: RECORDER_API_KEY_NAME,
      role_descriptors: {},
      metadata: {
        description: 'Created for synthetics recorder to create/modify journeys',
      },
    });

    if (apiKeyResult) return apiKeyResult;
    throw Error('API Key not generated for unknown reason.');
  },
});
