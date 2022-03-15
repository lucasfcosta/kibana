/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import axios from 'axios';
import {
  ManifestLocation,
  ServiceLocation,
  Locations,
  ServiceLocationsApiResponse,
} from '../../../common/runtime_types';
import { UptimeServerSetup } from '../adapters/framework';

export const getDevLocation = (devUrl: string): ServiceLocation => ({
  id: 'localhost',
  label: 'Local Synthetics Service',
  geo: { lat: 0, lon: 0 },
  url: devUrl,
  downloadBandwidthLimit: 100,
  uploadBandwidthLimit: 30,
});

export async function getServiceLocations(server: UptimeServerSetup) {
  let locations: Locations = [];

  if (process.env.NODE_ENV !== 'production' && server.config.service?.devUrl) {
    locations = [getDevLocation(server.config.service.devUrl)];
  }

  if (!server.config.service?.manifestUrl) {
    return { locations };
  }

  try {
    const { data } = await axios.get<{ locations: Record<string, ManifestLocation> }>(
      server.config.service!.manifestUrl!
    );

    Object.entries(data.locations).forEach(([locationId, location]) => {
      locations.push({
        id: locationId,
        label: location.geo.name,
        geo: location.geo.location,
        url: location.url,
        isServiceManaged: true,
        // TODO use the same constants here
        downloadBandwidthLimit: location.downloadBandwidthLimit,
        uploadBandwidthLimit: location.uploadBandwidthLimit,
      });
    });

    return { locations } as ServiceLocationsApiResponse;
  } catch (e) {
    server.logger.error(e);
    return {
      locations: [],
    } as ServiceLocationsApiResponse;
  }
}
