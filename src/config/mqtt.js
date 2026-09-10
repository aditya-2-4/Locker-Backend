import mqtt from 'mqtt';
import net from 'net';
import aedes from 'aedes';
import { config } from './env.js';

let aedesInstance = null;
let aedesServer = null;
let mqttClient = null;

export async function initMQTT(messageHandler) {
  // 1. Optionally start embedded broker if enabled
  if (config.embeddedMqtt) {
    try {
      aedesInstance = new aedes();
      aedesServer = net.createServer(aedesInstance.handle);

      await new Promise((resolve) => {
        aedesServer.listen(config.mqttPort, () => {
          console.log(`📡 Embedded MQTT broker started on port ${config.mqttPort}`);
          resolve(true);
        });

        aedesServer.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${config.mqttPort} in use; connecting to existing MQTT broker on that port.`);
            resolve(false);
          } else {
            console.error('MQTT Server error:', err.message);
            resolve(false);
          }
        });
      });

      if (aedesInstance) {
        aedesInstance.on('client', (client) => {
          console.log(`🔌 MQTT client connected: ${client ? client.id : 'unknown'}`);
        });
        aedesInstance.on('clientDisconnect', (client) => {
          console.log(`🔌 MQTT client disconnected: ${client ? client.id : 'unknown'}`);
        });
      }
    } catch (err) {
      console.warn('⚠️ Could not start embedded MQTT broker:', err.message);
    }
  }

  // 2. Connect client to MQTT Broker
  console.log(`Connecting MQTT Client to ${config.mqttBrokerUrl}...`);
  mqttClient = mqtt.connect(config.mqttBrokerUrl, {
    clientId: `backend_server_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 5000,
  });

  mqttClient.on('connect', () => {
    console.log(`✅ Backend connected to MQTT broker (${config.mqttBrokerUrl})`);

    // Subscribe to all locker topics:
    // locker/{lockerId}/status
    // locker/{lockerId}/rfid
    // locker/{lockerId}/sensor
    // locker/{lockerId}/lock/closed
    // locker/{lockerId}/heartbeat
    mqttClient.subscribe('locker/+/status', { qos: 1 });
    mqttClient.subscribe('locker/+/rfid', { qos: 1 });
    mqttClient.subscribe('locker/+/sensor', { qos: 1 });
    mqttClient.subscribe('locker/+/lock/closed', { qos: 1 });
    mqttClient.subscribe('locker/+/heartbeat', { qos: 0 });

    console.log('📬 Subscribed to topics: locker/+/status, rfid, sensor, lock/closed, heartbeat');
  });

  mqttClient.on('error', (err) => {
    console.error('❌ MQTT Client error:', err.message);
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
  });

  mqttClient.on('message', (topic, messageBuffer) => {
    if (messageHandler) {
      messageHandler(topic, messageBuffer.toString());
    }
  });

  return mqttClient;
}

export function publishMQTT(topic, payload, options = {}) {
  if (!mqttClient || !mqttClient.connected) {
    console.warn(`⚠️ Cannot publish to ${topic}: MQTT client not connected.`);
    return false;
  }
  const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  mqttClient.publish(topic, payloadStr, options, (err) => {
    if (err) {
      console.error(`❌ Failed to publish to ${topic}:`, err.message);
    } else {
      console.log(`📤 Published MQTT [${topic}]:`, payloadStr);
    }
  });
  return true;
}

export function getMQTTClient() {
  return mqttClient;
}
