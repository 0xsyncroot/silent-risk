"""
Database Module (Privacy-First)

Exports:
- mongodb: MongoDB connection manager
- MLStatsRepository: ML performance tracking (anonymous)
- DailyStatisticsRepository: Daily aggregates (anonymous)

NOT exported (removed for privacy):
- AnalyticsRepository: Would track wallet analysis (privacy violation)
- AttestationRepository: Would track user attestations (privacy violation)
"""

from app.db.mongodb import mongodb
from app.db.repositories import MLStatsRepository, DailyStatisticsRepository

__all__ = [
    "mongodb",
    "MLStatsRepository",
    "DailyStatisticsRepository",
]
