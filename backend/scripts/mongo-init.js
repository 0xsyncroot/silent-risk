// MongoDB Initialization Script
// Creates database, collections, and indexes for Silent Risk

db = db.getSiblingDB('silent_risk');

print('🚀 Initializing Silent Risk MongoDB...');

// Create collections with validation
db.createCollection('analytics', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['wallet_address', 'risk_score', 'risk_band', 'timestamp'],
      properties: {
        wallet_address: {
          bsonType: 'string',
          description: 'Ethereum wallet address'
        },
        risk_score: {
          bsonType: 'double',
          minimum: 0,
          maximum: 100,
          description: 'Risk score (0-100)'
        },
        risk_band: {
          bsonType: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          description: 'Risk category'
        },
        confidence: {
          bsonType: 'double',
          description: 'Model confidence (0-100)'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Analysis timestamp'
        }
      }
    }
  }
});

db.createCollection('ml_stats', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['model_version', 'accuracy', 'timestamp'],
      properties: {
        model_version: {
          bsonType: 'string',
          description: 'ML model version'
        },
        accuracy: {
          bsonType: 'double',
          minimum: 0,
          maximum: 100,
          description: 'Model accuracy (%)'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Record timestamp'
        }
      }
    }
  }
});

db.createCollection('attestations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['attestation_id', 'wallet_address', 'risk_band', 'attested_at'],
      properties: {
        attestation_id: {
          bsonType: 'string',
          description: 'Unique attestation ID'
        },
        wallet_address: {
          bsonType: 'string',
          description: 'Wallet address'
        },
        risk_band: {
          bsonType: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          description: 'Attested risk level'
        },
        attested_at: {
          bsonType: 'date',
          description: 'Attestation timestamp'
        }
      }
    }
  }
});

db.createCollection('daily_statistics');

print('✓ Collections created');

// Create indexes for optimal query performance
print('📊 Creating indexes...');

// Analytics indexes
db.analytics.createIndex({ timestamp: -1 }, { name: 'timestamp_desc_idx' });
db.analytics.createIndex({ wallet_address: 1 }, { name: 'wallet_idx' });
db.analytics.createIndex({ risk_band: 1 }, { name: 'risk_band_idx' });
db.analytics.createIndex({ commitment: 1 }, { name: 'commitment_idx', sparse: true });
db.analytics.createIndex(
  { timestamp: -1, risk_band: 1 },
  { name: 'timestamp_risk_compound_idx' }
);

// ML stats indexes
db.ml_stats.createIndex({ timestamp: -1 }, { name: 'timestamp_desc_idx' });
db.ml_stats.createIndex({ model_version: 1 }, { name: 'model_version_idx' });
db.ml_stats.createIndex(
  { model_version: 1, timestamp: -1 },
  { name: 'model_version_timestamp_idx' }
);

// Attestations indexes
db.attestations.createIndex({ attested_at: -1 }, { name: 'attested_at_desc_idx' });
db.attestations.createIndex({ wallet_address: 1 }, { name: 'wallet_idx' });
db.attestations.createIndex({ attestation_id: 1 }, { name: 'attestation_id_idx', unique: true });
db.attestations.createIndex({ risk_band: 1 }, { name: 'risk_band_idx' });

// Daily statistics indexes
db.daily_statistics.createIndex({ date: -1 }, { name: 'date_desc_idx', unique: true });

print('✓ Indexes created');

// Insert initial data for testing
print('📝 Inserting sample data...');

// Sample analytics data
db.analytics.insertMany([
  {
    wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    risk_score: 25.5,
    risk_band: 'LOW',
    confidence: 94.2,
    risk_factors: {
      transaction_frequency: 20,
      large_transactions: 30,
      suspicious_patterns: 15
    },
    total_transactions: 342,
    total_volume_usd: 45000.0,
    commitment: '0xabc123...',
    passport_generated: true,
    timestamp: new Date(),
    created_at: new Date()
  },
  {
    wallet_address: '0x8f3Cf7ad23Cd3CaDbD9735AFF958023239c6A063',
    risk_score: 65.8,
    risk_band: 'MEDIUM',
    confidence: 91.5,
    risk_factors: {
      transaction_frequency: 60,
      large_transactions: 70,
      suspicious_patterns: 55
    },
    total_transactions: 1250,
    total_volume_usd: 180000.0,
    commitment: '0xdef456...',
    passport_generated: false,
    timestamp: new Date(),
    created_at: new Date()
  }
]);

// Sample ML stats
db.ml_stats.insertOne({
  model_version: 'v2.1.3',
  accuracy: 94.7,
  total_inferences: 547,
  encrypted_computations: 547,
  avg_latency_ms: 187.5,
  min_latency_ms: 145.2,
  max_latency_ms: 245.8,
  latencies: [182, 175, 187, 192, 178, 185, 181],
  timestamp: new Date(),
  last_trained: new Date(),
  model_type: 'concrete_ml',
  fhe_enabled: true
});

// Sample attestations
db.attestations.insertMany([
  {
    attestation_id: '0x1a2b3c4d',
    wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    risk_band: 'LOW',
    commitment: '0xabc123...',
    tx_hash: '0xabcdef123456',
    block_number: 12345678,
    verified: true,
    attested_at: new Date()
  },
  {
    attestation_id: '0x5e6f7g8h',
    wallet_address: '0x8f3Cf7ad23Cd3CaDbD9735AFF958023239c6A063',
    risk_band: 'MEDIUM',
    commitment: '0xdef456...',
    tx_hash: '0x789xyz456789',
    block_number: 12345680,
    verified: true,
    attested_at: new Date()
  }
]);

print('✓ Sample data inserted');

print('✅ Silent Risk MongoDB initialization complete!');
print('📊 Collections: analytics, ml_stats, attestations, daily_statistics');
print('🔍 Indexes: Created for optimal query performance');
print('📝 Sample data: 2 analyses, 1 ML stat, 2 attestations');

