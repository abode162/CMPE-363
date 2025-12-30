import http from 'k6/http';
import { check } from 'k6';
import { config } from './config.js';

export const options = {
    iterations: 1,
};

export default function () {
    // Generate a random code that doesn't exist
    const nonExistentCode = `missing-${Date.now()}`;
    const url = `${config.urls.analyticsService}/api/analytics/${nonExistentCode}`;
    
    const headers = { 
        'Content-Type': 'application/json',
        'X-Internal-API-Key': config.internalApiKey 
    };

    const res = http.get(url, { headers });

    check(res, {
        'Requesting missing stats returns 404': (r) => r.status === 404,
    });
}