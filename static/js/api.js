/**
 * DineMind AI — api.js
 * Centralized REST API client with CSRF protection, error normalization & JSON handling
 */

'use strict';

const API = {
  baseUrl: '/api',

  getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const csrfToken = this.getCookie('csrftoken');

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (response.status === 204) {
        return null;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let errorMsg = data.error || data.detail || 'An unexpected error occurred.';
        if (typeof data === 'object' && !data.error && !data.detail) {
          const keys = Object.keys(data);
          if (keys.length > 0) {
            const firstVal = data[keys[0]];
            errorMsg = Array.isArray(firstVal) ? `${keys[0]}: ${firstVal.join(', ')}` : `${keys[0]}: ${firstVal}`;
          }
        }
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${url}]:`, err);
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
