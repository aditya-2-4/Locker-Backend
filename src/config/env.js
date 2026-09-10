import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'book_locker_default_secret_jwt_2026',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  embeddedMqtt: process.env.EMBEDDED_MQTT === 'true' || !process.env.MQTT_BROKER_URL,
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  mqttPort: parseInt(process.env.MQTT_PORT || '1883', 10),
};
