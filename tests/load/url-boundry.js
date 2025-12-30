import http from 'k6/http';
import { check } from 'k6';
import { config } from './config.js';

export const options = {
    iterations: 1,
};

export default function () {
    const url = `${config.urls.urlService}/api/urls`;
    const headers = { 
        'Content-Type': 'application/json',
        'X-Guest-Claim-Token': 'test-token-123'
    };

    // Data with an invalid URL
    const payload = JSON.stringify({
        original_url: "ht tp://broken-url-string" 
    });

    const res = http.post(url, payload, { headers });

    check(res, {
        'Invalid URL format returns 400 or 422': (r) => r.status === 400 || r.status === 422,
    });
}