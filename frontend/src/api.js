// API endpoints for the password manager extension

import { useState, useEffect } from 'react';
import express from 'express';
import cors from 'cors';

// Get passwords from local storage
function getPasswordsFromStorage() {
  try {
    const encryptedData = localStorage.getItem('encryptedPasswords');
    if (!encryptedData) {
      return [];
    }
    
    // Return the encrypted data as-is - extension will handle decryption
    // In a real implementation, you would decrypt this data before sending
    // But for demo purposes, we're returning the raw data
    return JSON.parse(encryptedData);
  } catch (error) {
    console.error('Error getting passwords:', error);
    return [];
  }
}

// Start the API server
export function startApiServer() {
  const app = express();
  const PORT = 3001; // Using 3001 to avoid conflict with React's 3000
  
  // Add CORS middleware
  app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }));
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Health check endpoint
  app.get('/api/check', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // Passwords endpoint
  app.get('/api/passwords', (req, res) => {
    const passwords = getPasswordsFromStorage();
    res.json(passwords);
  });
  
  // Start the server
  const server = app.listen(PORT, () => {
    console.log(`Extension API server running on port ${PORT}`);
  });
  
  return server;
}

// Custom hook to manage the API server
export function useApiServer() {
  const [server, setServer] = useState(null);
  
  useEffect(() => {
    const apiServer = startApiServer();
    setServer(apiServer);
    
    // Clean up on unmount
    return () => {
      if (server) {
        server.close();
      }
    };
  }, []);
  
  return server;
} 