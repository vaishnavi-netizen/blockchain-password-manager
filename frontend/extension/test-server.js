// Simple test server to help debug extension connection issues
// Usage: node test-server.js

const http = require('http');

// Sample password data for testing
const samplePasswords = [
  {
    id: '1',
    website: 'github.com',
    username: 'testuser',
    password: 'password123'
  },
  {
    id: '2',
    website: 'gmail.com',
    username: 'user@example.com',
    password: 'securepass456'
  }
];

// Create server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Basic routing
  const url = req.url;
  
  if (url === '/api/check' && req.method === 'GET') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }
  else if (url === '/api/passwords' && req.method === 'GET') {
    // Get passwords endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(samplePasswords));
  }
  else if (url === '/api/passwords' && req.method === 'POST') {
    // Handle POST request to save passwords
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Received password data:', data);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Passwords saved successfully' 
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON data' 
        }));
      }
    });
  }
  else {
    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`
========================================================
🚀 Test server running at http://localhost:${PORT}
--------------------------------------------------------
Available endpoints:
  - Health check: GET http://localhost:${PORT}/api/check
  - Get passwords: GET http://localhost:${PORT}/api/passwords
  - Save passwords: POST http://localhost:${PORT}/api/passwords
--------------------------------------------------------
Use this server for extension testing.
Press Ctrl+C to stop the server.
========================================================
  `);
}); 