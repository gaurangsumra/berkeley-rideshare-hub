import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, location } = await req.json();

    if (!location || location.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = Deno.env.get('EVENTBRITE_PRIVATE_TOKEN');
    
    if (!token) {
      console.error('EVENTBRITE_PRIVATE_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Eventbrite integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range: today to 30 days from now
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    console.log('Searching Eventbrite:', { query, location, startDate: startDate.toISOString(), endDate: endDate.toISOString() });

    // Build Eventbrite API URL with parameters
    const params = new URLSearchParams({
      'location.address': location,
      'location.within': '25mi',
      'start_date.range_start': startDate.toISOString(),
      'start_date.range_end': endDate.toISOString(),
      'expand': 'venue',
      'page': '1',
    });

    if (query && query.trim()) {
      params.append('q', query.trim());
    }

    const url = `https://www.eventbriteapi.com/v3/events/search/?${params.toString()}`;

    console.log('Calling Eventbrite API:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Eventbrite API error:', response.status, errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid Eventbrite API token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Eventbrite API error', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Eventbrite API response:', { 
      pagination: data.pagination,
      event_count: data.events?.length || 0
    });

    // Filter out online events
    const filteredEvents = (data.events || []).filter((event: any) => {
      // Must have a venue
      if (!event.venue) {
        console.log('Filtering out event (no venue):', event.name?.text);
        return false;
      }

      // Must have a physical address
      if (!event.venue.address) {
        console.log('Filtering out event (no address):', event.name?.text);
        return false;
      }

      const city = event.venue?.address?.city?.toLowerCase() || '';
      const venueName = event.venue?.name?.toLowerCase() || '';

      // Exclude if city is "Online" or empty
      if (city === 'online' || city === '') {
        console.log('Filtering out event (online/empty city):', event.name?.text, city);
        return false;
      }

      // Exclude if venue name contains "online"
      if (venueName.includes('online')) {
        console.log('Filtering out event (online venue):', event.name?.text, venueName);
        return false;
      }

      return true;
    });

    console.log(`Filtered ${data.events?.length || 0} events down to ${filteredEvents.length} in-person events`);

    // Transform events to our format
    const transformedEvents = filteredEvents.map((event: any) => ({
      eventbrite_id: event.id,
      name: event.name?.text || 'Untitled Event',
      date_time: event.start?.local || event.start?.utc,
      destination: event.venue?.address?.localized_address_display || 
                   `${event.venue?.address?.address_1 || ''}, ${event.venue?.address?.city || ''}`.trim(),
      city: event.venue?.address?.city || '',
      description: event.description?.text || event.summary || null,
      image_url: event.logo?.url || null,
      url: event.url || null,
    }));

    return new Response(
      JSON.stringify({ events: transformedEvents }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in eventbrite-search function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
