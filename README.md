# Jeopardy Builder

A modern, full-stack Jeopardy-style trivia platform for creating and hosting interactive games.

![Main Page](assets/mainpage.png)

## About the Project
Jeopardy Builder was created to provide a seamless way for educators, teams, and trivia enthusiasts to build custom game boards and host live sessions. It focuses on a "Premium" aesthetic with smooth transitions, real-time score tracking, and a robust game-building interface.

### Tool Stack
- **Frontend**: React, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Go (Golang)
- **Database**: PostgreSQL (via Docker)
- **Deployment**: Docker, Nginx

## Getting Started

### Prerequisites
- [Docker](https://www.docker.com/get-started) and Docker Compose

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/QudahM/jeopardy-builder.git
   cd jeopardy-builder
   ```

2. Launch the application:
   ```bash
   docker compose up --build -d
   ```

3. Open your browser and navigate to `http://localhost`.

## Usage
![Creating a Jeopardy Game](assets/usage.gif)

1. **Build**: Use the "Create Game" interface to define your categories and clues.
2. **Setup**: Add your contestants and start a new session.
3. **Play**: Click tiles to reveal clues, use the overlay to adjust team scores, and track progress until the board is clear!

## License
Distributed under the MIT License. See `LICENSE` for more information.
