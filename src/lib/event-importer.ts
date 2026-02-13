import axios from 'axios';
import ical from 'node-ical';
import fs from 'fs';
import fetch from 'node-fetch'; // Import node-fetch for Nominatim API calls

// Haas School of Business coordinates
const HAAS_LATITUDE = 37.8697;
const HAAS_LONGITUDE = -122.2521;

const ICS_URL = 'https://haas.campusgroups.com/ical/haas/ical_haas.ics';
const OUTPUT_PATH = './src/data/haas-events.json';

// --- Geocoding and Distance Calculation Functions ---

// Function to add a delay to respect API rate limits
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Geocode an address using Nominatim (OpenStreetMap)
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!address || address === "Location Unknown") {
    return null;
  }
  
  // Basic check to avoid geocoding non-specific locations
  if (address.length < 5 || address.toLowerCase().includes("online")) {
    return null;
  }

  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  try {
    // Implement a delay to respect Nominatim's rate limit (1 request per second)
    await delay(1000); 
    const response = await fetch(nominatimUrl, {
        headers: {
            'User-Agent': 'BerkeleyRideshareHub/1.0 (https://your-app-website.com)' // Replace with your actual website
        }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error(`Error geocoding address "${address}":`, error);
  }
  return null;
}

// Calculate Haversine distance between two points in kilometers
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in kilometers

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in km
  return distance;
}

// --- Main Import Function ---

async function importHaasEvents() {
  try {
    console.log(`Fetching ICS file from ${ICS_URL}...`);
    const response = await axios.get(ICS_URL);
    const icsData = response.data;

    console.log('Parsing ICS data...');
    const events = await ical.async.parseICS(icsData);

    const processedEvents: any[] = []; // Use 'any' for now as we add properties dynamically

    for (const event of Object.values(events)) {
      if (event.type === 'VEVENT') {
        const location = /sign in to download location/i.test(event.location) ? "Location Unknown" : event.location;
        let eventLatitude: number | null = null;
        let eventLongitude: number | null = null;
        let distanceFromHaas: number | null = null;

        if (location && location !== "Location Unknown") {
          const geocodedLocation = await geocodeAddress(location);
          if (geocodedLocation) {
            eventLatitude = geocodedLocation.latitude;
            eventLongitude = geocodedLocation.longitude;
            distanceFromHaas = haversineDistance(
              HAAS_LATITUDE,
              HAAS_LONGITUDE,
              eventLatitude,
              eventLongitude
            );
          }
        }

        processedEvents.push({
          title: event.summary,
          startDate: event.start,
          endDate: event.end,
          location: location,
          description: event.description,
          url: event.url,
          uid: event.uid,
          latitude: eventLatitude,
          longitude: eventLongitude,
          distanceFromHaas: distanceFromHaas,
        });
      }
    }

    // Sort events by distanceFromHaas in descending order (further away first)
    processedEvents.sort((a, b) => {
      // Handle null distances: treat null as very far for sorting purposes
      const distA = a.distanceFromHaas !== null ? a.distanceFromHaas : Number.MAX_VALUE;
      const distB = b.distanceFromHaas !== null ? b.distanceFromHaas : Number.MAX_VALUE;
      
      if (distA === distB) {
        // If distances are equal, sort by start date (ascending)
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      }
      return distB - distA; // Descending distance
    });

    console.log(`Processed ${processedEvents.length} events.`);

    const dataDir = './src/data';
    if (!fs.existsSync(dataDir)){
        fs.mkdirSync(dataDir);
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(processedEvents, null, 2));

    console.log(`Events saved to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Error importing Haas events:', error);
  }
}

importHaasEvents();
