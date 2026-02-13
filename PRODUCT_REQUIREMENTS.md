# Product Requirements Document: Berkeley Rideshare Hub 2.0

## 1. Vision & Goals

**Vision:** To transform Berkeley Rideshare Hub from a passive ride discovery platform into a proactive, intent-driven service that automatically connects users attending the same events and facilitates the formation of ride-sharing groups.

**Goals:**
*   Increase user engagement and retention.
*   Become the go-to platform for Haas students to coordinate rides for school-related and social events.
*   Streamline the process of finding and forming ride groups.
*   Foster a stronger sense of community among students.

## 2. User Personas

*   **The Social Planner:** A Haas student who frequently organizes outings with friends and is looking for an easier way to coordinate transportation.
*   **The Busy Student:** A student with a packed schedule who needs a quick and reliable way to find rides to events.
*   **The New Student:** A new student who is looking to meet people and get involved in campus life.

## 3. User Flow

1.  **Onboarding:** New users sign up and are immediately prompted to connect their calendars.
2.  **Event Sync:**
    *   The app first attempts to automatically import events from the Haas Campus Groups website.
    *   If the user's event is not listed, they can import it from their personal calendar (Google, Apple, etc.).
3.  **Event Dashboard:** The user sees a list of their upcoming events.
4.  **Ride Matching:**
    *   For each event, the user can see a list of other attendees who are also looking for a ride.
    *   If no ride groups exist, the user can invite up to four other attendees to form a group.
5.  **Group Formation:**
    *   Invitations are sent via WhatsApp.
    *   Once enough users accept, a WhatsApp group is automatically created.
6.  **Ride Coordination:** The rest of the coordination happens in the WhatsApp group.

## 4. Phase 1: Calendar Sync & Matching

### 4.1. Haas Campus Groups Integration

*   **Description:** The application will automatically scrape the Haas Campus Groups website for a list of upcoming events. The user will be able to select which of these events they are attending.
*   **Technical Requirements:**
    *   **Web Scraping:** A service that regularly scrapes the Haas Campus Groups website. This will likely require using a library like Puppeteer or Cheerio.
    *   **Authentication:** The scraper will need to be able to log in to the Campus Groups website, which might require securely storing credentials.
    *   **Backend:** An endpoint to serve the scraped events to the frontend.
    *   **Frontend:** A UI to display the list of Haas events and allow users to select them.

### 4.2. Personal Calendar Import

*   **Description:** If a user's event is not on the Haas Campus Groups website, they can import it from their personal calendar.
*   **Technical Requirements:**
    *   **OAuth Integration:** Implement OAuth 2.0 for Google Calendar, Apple Calendar, and Outlook Calendar.
    *   **iCal Parsing:** A library to parse the iCal format.
    *   **Backend:** Endpoints for handling OAuth callbacks and processing calendar data.
    *   **Frontend:** A UI for connecting personal calendars and selecting events.

### 4.3. Event Matching & Group Formation

*   **Description:** The application will match users who have selected the same event.
*   **Technical Requirements:**
    *   **Database:** A new table to store user-event relationships.
    *   **Backend:** Logic to match users based on event IDs.
    *   **Frontend:**
        *   A UI to display the list of attendees for an event.
        *   A mechanism to select and invite users to form a group.
        *   A way to display existing ride groups for an event.

## 5. Phase 2: WhatsApp Automation

### 5.1. WhatsApp Business API Integration

*   **Description:** The application will use the WhatsApp Business API to send notifications and create groups.
*   **Technical Requirements:**
    *   **API Access:** Obtain approval from Meta to use the WhatsApp Business API.
    *   **Backend:** A service to interact with the WhatsApp API.
    *   **Secure Storage:** Securely store API keys and other credentials.

### 5.2. Bot Functionality

*   **Description:** A "Berkeley Rides" bot will act as an admin in the WhatsApp groups.
*   **Technical Requirements:**
    *   **Webhook:** A webhook to receive notifications from the WhatsApp API (e.g., when a user leaves a group).
    *   **Group Management Logic:** Logic to handle group creation, splitting, and other management tasks.
    *   **Notification Logic:** Logic to send notifications to users (e.g., ride reminders).

## 6. Non-Functional Requirements

*   **Privacy:** All user data, especially calendar data, must be encrypted and stored securely. The application must be compliant with GDPR and CCPA.
*   **Security:** The application must be protected against common web vulnerabilities (XSS, CSRF, etc.).
*   **Performance:** The application should be fast and responsive, especially the event matching process.
*   **Scalability:** The architecture should be able to handle a growing number of users and events.

## 7. Success Metrics

*   Number of active users.
*   Number of ride groups created per week.
*   User retention rate.
*   User satisfaction (measured through surveys).
