// Handles utility functions like map link conversions

const convertMapLinkToCoords = async (req, res) => {
  try {
    const { link } = req.body;

    if (!link) {
      return res.status(400).json({ error: 'Map link is required' });
    }

    // 1. Follow redirects if it's a shortlink
    let finalUrl = link;
    try {
      const response = await fetch(link, { method: 'HEAD', redirect: 'follow' });
      finalUrl = response.url;
    } catch (fetchErr) {
      console.warn('Could not fetch the URL, proceeding with the original link:', fetchErr.message);
    }

    // 2. Try to extract coordinates from the URL
    // Pattern 1: /@lat,lng,
    let match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    
    // Pattern 2: ?q=lat,lng
    if (!match) {
      match = finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    }
    
    // Pattern 3: /place/lat,lng/
    if (!match) {
      match = finalUrl.match(/\/place\/(-?\d+\.\d+),(-?\d+\.\d+)/);
    }
    
    // Pattern 4: /search/lat,lng/
    if (!match) {
      match = finalUrl.match(/\/search\/(-?\d+\.\d+),(-?\d+\.\d+)/);
    }

    if (match && match.length >= 3) {
      const latitude = parseFloat(match[1]);
      const longitude = parseFloat(match[2]);
      
      return res.json({
        success: true,
        latitude,
        longitude,
        originalLink: link,
        resolvedUrl: finalUrl
      });
    }

   
    return res.status(400).json({ 
      error: 'Could not extract coordinates from the provided link.',
      resolvedUrl: finalUrl
    });

  } catch (error) {
    console.error('Error converting map link:', error);
    res.status(500).json({ error: 'Failed to convert map link to coordinates' });
  }
};

module.exports = {
  convertMapLinkToCoords
};
