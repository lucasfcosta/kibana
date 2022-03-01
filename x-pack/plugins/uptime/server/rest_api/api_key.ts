/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import { UMRestApiRouteFactory } from './types';
import { SavedObjectsType } from '../../../../../src/core/server';

export const RECORDER_API_KEY_NAME = 'synthetics-recorder-api-key';
const API_KEY_UUID = '1219261d-9c65-4d92-912f-6aa49cdad34f';

export const recorderApiKey: SavedObjectsType = {
  name: RECORDER_API_KEY_NAME,
  hidden: true,
  namespaceType: 'single',
  mappings: {
    dynamic: false,
    properties: {
      apiKey: {
        type: 'binary',
      },
    },
  },
  management: {
    importableAndExportable: false,
    icon: 'uptimeApp',
    getTitle: () =>
      i18n.translate('xpack.uptime.synthetics.recorder.apiKey', {
        defaultMessage: 'Synthetics Recorder API key',
      }),
  },
};

/**
 * TODO: a solution like this could be quite nice to create reproducible UUIDs
 * for the encrypted saved object ID, so we could tie the saved object ID to the
 * ID of the API key we generate for the user.
 */
// function uuidFromString(s: string) {
//   return stringify(Buffer.from(s, 'utf8'));
// }

export const createApiKeyRoute: UMRestApiRouteFactory = () => ({
  method: 'GET',
  path: '/internal/uptime/api_key',
  validate: false,
  handler: async (args): Promise<any> => {
    const { context, request, server } = args;
    const { security, authSavedObjectsClient, encryptedSavedObjects } = server;
    if (!(await security.authc.apiKeys?.areAPIKeysEnabled())) {
      // TODO: improve error message
      throw Error('API KEYS ARE NOT ENABLED');
    }
    // TODO: improve error message
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

    const encryptedClient = encryptedSavedObjects.getClient({
      includedHiddenTypes: [RECORDER_API_KEY_NAME],
    });
    /**
     * Get the saved object for the API key, if it exists.
     */
    if (apiKey) {
      /**
       * Use the default GUID to find the encrypted saved object for the API key
       */
      const apiSavedObject = await encryptedClient.getDecryptedAsInternalUser(
        RECORDER_API_KEY_NAME,
        API_KEY_UUID
      );

      return apiSavedObject.attributes;
    }
    /**
     * If there's no API key for this user to use with the recorder, create it
     */
    const apiKeyResult = await security.authc.apiKeys?.create(request, {
      name: RECORDER_API_KEY_NAME,
      role_descriptors: {},
      metadata: {
        description: 'Created for synthetics recorder to create/modify journeys',
      },
    });

    if (apiKeyResult) {
      await authSavedObjectsClient?.create(RECORDER_API_KEY_NAME, apiKeyResult, {
        // TODO: it would be nice to not use a hardcoded GUID
        // id: uuidFromString(apiKeyResult.id),
        id: API_KEY_UUID,
        overwrite: true,
      });
    }

    if (apiKeyResult) return apiKeyResult;
    // TODO: improve error message
    throw Error('API Key not generated for unknown reason.');
  },
});
