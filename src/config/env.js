import dotenv from 'dotenv';
dotenv.config();

// FAILSAFE FOR RENDER DEPLOYMENTS
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'book_locker_default_secret_jwt_2026',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  tursoDatabaseUrl: process.env.TURSO_DATABASE_URL || 'libsql://book-locker-aditya-2-4.aws-ap-south-1.turso.io',
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJnaWQiOiI3MWRlNTA3Ny1mODE0LTQ3MjAtYTc5MC0zZjVkMmVkMDMwOWIiLCJpYXQiOjE3ODkwNTY3MDcsImtpZCI6IjlERlN0dklyUlNaclJrV0FKdFFjYTE2al83OVc3SHctMVpRVlR3WUhLQU0iLCJyaWQiOiI3MTczNjgyYi1mMmFiLTQwMzAtYTg5ZC00ZjVhM2Y5OTY1NTcifQ.uoHSEiAIaRGGty-ApYoD6ukcXajBzAhGawO4N_0OQqiBumPJMwapFH5YMbwfqwf2_N9vDOr72pX9uXfNBNIWBw',
  embeddedMqtt: process.env.EMBEDDED_MQTT === 'true' || !process.env.MQTT_BROKER_URL,
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  mqttPort: parseInt(process.env.MQTT_PORT || '1883', 10),
};
