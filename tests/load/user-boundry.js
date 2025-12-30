import http from 'k6/http';
import { check } from 'k6';
import { config } from './config.js';

export const options = {
    iterations: 1,
};

export default function () {
    const url = `${config.urls.userService}/api/auth/register`;
    const headers = { 'Content-Type': 'application/json' };
    
    // Create a user email
    const duplicateUser = {
        email: 'boundary-test@example.com',
        password: 'password123',
        name: 'Boundary Tester'
    };

    // Step 1: Register the user for the first time (Should Succeed)
    http.post(url, JSON.stringify(duplicateUser), { headers });

    // Step 2: Try to register the SAME user again (Should Fail)
    const res = http.post(url, JSON.stringify(duplicateUser), { headers });

    // Step 3: Assert we get a 409 Conflict
    check(res, {
        'Duplicate registration returns 409': (r) => r.status === 409,
        'Error message is present': (r) => r.json('detail') !== undefined || r.json('error') !== undefined,
    });
}