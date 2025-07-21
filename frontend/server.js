// Simple Express server for the password manager extension API

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Add CORS middleware
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Function to get passwords from local storage
// This won't work directly since localStorage is a browser API
// We'll need to read from a file or your blockchain
function getPasswordsFromStorage() {
  try {
    // Check if we have a passwords JSON file saved 
    if (fs.existsSync(path.join(__dirname, 'passwords.json'))) {
      const data = fs.readFileSync(path.join(__dirname, 'passwords.json'), 'utf8');
      return JSON.parse(data);
    }
    
    // If no file exists, return empty array
    return [];
  } catch (error) {
    console.error('Error getting passwords:', error);
    return [];
  }
}

// Health check endpoint
app.get('/api/check', (req, res) => {
  res.json({ status: 'ok' });
});

// Passwords endpoint
app.get('/api/passwords', (req, res) => {
  try {
    // Get actual passwords
    const passwords = getPasswordsFromStorage();
    
    // If we have real passwords, validate and send them
    if (passwords && passwords.length > 0) {
      // Ensure all passwords have the required fields
      const validPasswords = passwords.map(pwd => {
        return {
          website: pwd.website || 'Unknown Website',
          username: pwd.username || 'Not provided',
          password: pwd.password || '',
          id: pwd.id || Date.now().toString()
        };
      });
      
      return res.json(validPasswords);
    }
    
    // Otherwise, use sample data for testing
    const samplePasswords = [
      {
        id: '1',
        website: 'example.com',
        username: 'user@example.com',
        password: 'Password123'
      },
      {
        id: '2',
        website: 'test.com',
        username: 'testuser',
        password: 'TestPass456'
      },
      {
        id: '3',
        website: 'github.com',
        username: 'githubuser',
        password: 'GitHubPassword789'
      }
    ];
    
    res.json(samplePasswords);
  } catch (error) {
    console.error('Error retrieving passwords:', error);
    res.status(500).json({ error: 'Failed to retrieve passwords' });
  }
});

// Endpoint to save passwords from the blockchain app
app.post('/api/passwords', (req, res) => {
  try {
    const { passwords } = req.body;
    if (!passwords) {
      return res.status(400).json({ error: 'No passwords provided' });
    }
    
    // Validate the password format
    const validPasswords = passwords.filter(pwd => {
      // Ensure we have the minimum required fields
      return pwd && pwd.website && pwd.username && pwd.password;
    });
    
    if (validPasswords.length === 0) {
      return res.status(400).json({ 
        error: 'No valid passwords found in the provided data',
        received: passwords.length
      });
    }
    
    // Save passwords to a file
    fs.writeFileSync(
      path.join(__dirname, 'passwords.json'),
      JSON.stringify(validPasswords),
      'utf8'
    );
    
    return res.json({ 
      success: true, 
      message: 'Passwords saved successfully',
      count: validPasswords.length
    });
  } catch (error) {
    console.error('Error saving passwords:', error);
    return res.status(500).json({ error: 'Failed to save passwords' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Extension API server running on port ${PORT}`);
  console.log(`- Check API: http://localhost:${PORT}/api/check`);
  console.log(`- Get passwords: http://localhost:${PORT}/api/passwords`);
}); 