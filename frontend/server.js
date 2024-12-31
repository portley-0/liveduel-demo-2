const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const PORT = 3001; // Port for the proxy server



// Enable CORS
app.use(cors());

// Proxy endpoint for fixtures
app.get('/api/fixtures', async (req, res) => {
    
    try {
        const { league, season, from, to } = req.query;

        // Make the API request to the external API
        const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
            headers: {
                'x-apisports-key': process.env.API_KEY, // Use a secure, server-side variable
            },
            params: { league, season, from, to },
        });

        // Forward the response back to the frontend
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from the API:', error.message);
        res.status(500).send('Error fetching data from the API');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
});
