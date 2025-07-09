// AI Business Opportunity Scanner - Server
// MVP Implementation

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Placeholder server setup
app.get('/', (req, res) => {
  res.send('AI Business Opportunity Scanner - Coming Soon');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});