# ArvaForm Backend

A robust and scalable NestJS backend application for the ArvaForm platform - a
comprehensive form management solution.

## 🚀 Features

- **Modern Architecture**: Built with NestJS framework and TypeScript
- **Database Integration**: MongoDB with Mongoose ODM
- **Security First**: Helmet, CORS, rate limiting, and input validation
- **Developer Experience**: Hot reload, comprehensive logging, and API
  documentation
- **Production Ready**: Health checks, monitoring, and environment configuration
- **Type Safety**: Strict TypeScript configuration with comprehensive type
  checking

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (required package manager)
- **MongoDB** >= 5.0 (local installation or MongoDB Atlas)

## 🛠️ Installation

1. **Clone the repository** (if not already done):

   ```bash
   git clone <repository-url>
   cd arvaform-backend
   ```

2. **Install dependencies** using pnpm:

   ```bash
   pnpm install
   ```

3. **Set up environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```

4. **Configure your environment**: Edit the `.env` file and update the following
   variables:
   ```bash
   PORT=3001
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/arvaform
   CORS_ORIGINS=http://localhost:3000
   ```

## 🚀 Running the Application

### Development Mode

```bash
# Start with hot reload
pnpm run start:dev

# Start with debug mode
pnpm run start:debug
```

### Production Mode

```bash
# Build the application
pnpm run build

# Start production server
pnpm run start:prod
```

## 📖 API Documentation

When running in development mode, comprehensive API documentation is available
at:

- **Swagger UI**: `http://localhost:3001/api/docs`

## 🔍 Available Endpoints

### Health Check

- **GET** `/api/health` - Comprehensive health status including system metrics
  and database connectivity
- **GET** `/api` - Basic application information

## 🧪 Testing

```bash
# Run unit tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run test coverage
pnpm run test:cov

# Run e2e tests
pnpm run test:e2e
```

## 🔧 Development Tools

### Code Quality

```bash
# Run ESLint
pnpm run lint

# Format code with Prettier
pnpm run format

# Type checking
pnpm run typecheck
```

### Building

```bash
# Build for production
pnpm run build

# Clean build directory
pnpm run prebuild
```

## 📁 Project Structure

```
src/
├── config/           # Configuration files and factories
│   └── app.config.ts # Main application configuration
├── common/           # Shared utilities and decorators (future)
├── modules/          # Feature modules (future)
├── app.controller.ts # Root application controller
├── app.service.ts    # Root application service
├── app.module.ts     # Root application module
└── main.ts          # Application bootstrap
```

## 🔒 Security Features

- **Helmet**: Security headers middleware
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Multiple-tier throttling protection
- **Input Validation**: Comprehensive request validation with class-validator
- **Environment Variables**: Secure configuration management

## 📊 Monitoring and Logging

- **Health Checks**: Detailed system and database health monitoring
- **Structured Logging**: Comprehensive logging with different levels
- **Memory Monitoring**: Real-time memory usage tracking
- **Database Monitoring**: Connection status and ping checks

## 🌍 Environment Configuration

The application supports multiple environment configurations:

- **Development**: Full logging, Swagger documentation, relaxed security
- **Production**: Optimized logging, enhanced security, no debug tools
- **Test**: Minimal logging, isolated database

## 📝 Environment Variables

| Variable       | Description          | Default                              |
| -------------- | -------------------- | ------------------------------------ |
| `PORT`         | Server port          | `3001`                               |
| `NODE_ENV`     | Environment          | `development`                        |
| `MONGODB_URI`  | Database connection  | `mongodb://localhost:27017/arvaform` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000`              |
| `API_PREFIX`   | API route prefix     | `api`                                |

See `.env.example` for the complete list of available environment variables.

## 🚀 Deployment

### Production Checklist

1. ✅ Set `NODE_ENV=production`
2. ✅ Configure secure `MONGODB_URI`
3. ✅ Set appropriate `CORS_ORIGINS`
4. ✅ Configure `JWT_SECRET` for authentication
5. ✅ Set up monitoring and logging
6. ✅ Configure reverse proxy (nginx)
7. ✅ Set up SSL certificates

### Docker Support (Coming Soon)

Docker configuration will be added in future updates for containerized
deployment.

## 🤝 Contributing

1. Follow the established code style (ESLint + Prettier)
2. Write comprehensive tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting

## 📋 Scripts Reference

| Command                | Description             |
| ---------------------- | ----------------------- |
| `pnpm run start`       | Start application       |
| `pnpm run start:dev`   | Start with hot reload   |
| `pnpm run start:debug` | Start with debugging    |
| `pnpm run start:prod`  | Start production build  |
| `pnpm run build`       | Build for production    |
| `pnpm run test`        | Run tests               |
| `pnpm run test:watch`  | Run tests in watch mode |
| `pnpm run test:cov`    | Run tests with coverage |
| `pnpm run lint`        | Run ESLint              |
| `pnpm run format`      | Format code             |

## 🛠️ Tech Stack

- **Framework**: NestJS v10
- **Language**: TypeScript v5
- **Database**: MongoDB with Mongoose
- **Validation**: class-validator & class-transformer
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, CORS, Throttling
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

## 📞 Support

For support and questions, please refer to the project documentation or contact
the development team.

---

Built with ❤️ by the ArvaForm team
