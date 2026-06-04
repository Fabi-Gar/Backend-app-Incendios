# 🔥 Wildfire Monitoring & Alert System - Backend API

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</div>

<br>

Backend architecture for a comprehensive wildfire monitoring and alert system in Guatemala. Built to handle geospatial data, dynamic reporting, and real-time push notifications.

> **Note:** You can find the React Native (Expo) frontend repository [here](#YOUR_FRONTEND_LINK).

## 🚀 Quick Start

### Choose your setup method:

**🐳 With Docker (Recommended for development):**

👉 **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** - Complete Docker Guide

```bash
# Quick start with Docker
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --build
💻 Local Setup (Without Docker):

👉 DATABASE_SETUP.md - Complete Database Setup Guide

Bash
# Quick local start
npm install
npm run build
npm run migration:run
npm run seed && npm run seed:plantilla
npm run dev
🏗️ Architecture & Stack
Core Technologies
Runtime: Node.js 18+

Framework: Express 5

Language: TypeScript

Database: PostgreSQL 14+ with PostGIS (for geospatial tracking)

ORM: TypeORM

Validation: Zod

Auth: JWT

Notifications: Firebase Cloud Messaging (FCM)

Key Features
✅ Geospatial Fire Management: PostGIS integration for geographic tracking, affected zones mapping, and status workflows (with Admin approval/rejection).

✅ Dynamic Reporting System: Admin-configurable templates, hierarchical form fields supporting 12 data types, and custom validations.

✅ Robust RBAC: Strict Role-Based Access Control (Admin, Operator, Analyst, User) governing viewing and editing capabilities.

✅ Complete Audit Trail: Soft deletes implemented across all tables, before/after change tracking, and user action logging.

📚 API Documentation
The complete API documentation (OpenAPI specification) can be found here:

👉 openapi-cierre.yaml

Includes 20+ documented endpoints, data schemas, request/response examples, and error codes.

Main Endpoints Overview
GET /incendios - List fires (Geospatial query support)

POST /incendios - Report a new fire

POST /cierre/:incendio_uuid/respuestas - Submit dynamic form responses

POST /incendios/:uuid/aprobar - Approve report (Admin only)

POST /cierre-admin/plantillas - Create dynamic template (Admin only)

📁 Project Structure
Plaintext
backend-final/
├── src/
│   ├── db/                 # Database migrations, seeds, and TypeORM config
│   ├── modules/
│   │   ├── incendios/      # Fire tracking & geolocation logic
│   │   ├── cierre/         # Dynamic form & reporting system
│   │   ├── seguridad/      # Auth, RBAC, users
│   │   └── notificaciones/ # FCM Push notifications
│   ├── middlewares/        # Global error & auth middlewares
│   ├── utils/              # Pagination, custom logger (Pino)
│   └── server.ts           # Application entry point
├── DATABASE_SETUP.md       # 📖 DB Setup instructions
└── openapi-cierre.yaml     # API Documentation
🔑 Default Credentials (Dev)
Admin Email: admin@demo.local

Password: Admin123!

(Ensure these are rotated in production environments)

📦 Deployment
Build for Production
Bash
npm run build
NODE_ENV=production npm start
Docker Production Build
Bash
docker build -t fire-system-backend .
docker run -p 3000:3000 --env-file .env fire-system-backend
