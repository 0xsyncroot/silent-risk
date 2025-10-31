"""
MongoDB Repositories (Privacy-First)

PRIVACY DESIGN:
- Only MLStatsRepository (anonymous ML metrics)
- NO AnalyticsRepository (wallet data)
- NO AttestationRepository (user data)
- All wallet analysis: Redis cache + Client-side only
"""

import structlog
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING

from app.db.models import MLStatsRecord, DailyStatistics

logger = structlog.get_logger(__name__)


class MLStatsRepository:
    """
    ML Model Performance Statistics Repository (ANONYMOUS ONLY)
    
    Tracks ML model performance metrics without any user/wallet data.
    Used for ML dashboard and model monitoring.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["ml_stats"]
    
    async def record_inference(
        self,
        model_version: str,
        latency_ms: float,
        success: bool = True,
        accuracy: Optional[float] = None
    ) -> str:
        """
        Record a single ML inference (anonymous)
        
        Args:
            model_version: Model version used
            latency_ms: Inference latency in milliseconds
            success: Whether inference succeeded
            accuracy: Model confidence/accuracy for this inference
            
        Returns:
            Inserted document ID
        """
        try:
            # Find or create stats document for this model version
            stats = await self.collection.find_one({"model_version": model_version})
            
            if stats:
                # Update existing
                update_data = {
                    "$inc": {"total_inferences": 1},
                    "$set": {"timestamp": datetime.utcnow()}
                }
                
                # Update latency stats
                current_total = stats.get("total_inferences", 0)
                current_avg = stats.get("avg_latency_ms", 0.0)
                current_min = stats.get("min_latency_ms", float('inf'))
                current_max = stats.get("max_latency_ms", 0.0)
                
                new_total = current_total + 1
                new_avg = ((current_avg * current_total) + latency_ms) / new_total
                
                update_data["$set"].update({
                    "avg_latency_ms": new_avg,
                    "min_latency_ms": min(current_min, latency_ms),
                    "max_latency_ms": max(current_max, latency_ms)
                })
                
                # Update accuracy array if provided
                if accuracy is not None:
                    update_data["$push"] = {
                        "accuracies": {
                            "$each": [accuracy],
                            "$slice": -100  # Keep last 100 accuracies
                        }
                    }
                
                await self.collection.update_one(
                    {"model_version": model_version},
                    update_data
                )
                
                return str(stats["_id"])
            else:
                # Create new
                record = MLStatsRecord(
                    model_version=model_version,
                    accuracy=accuracy if accuracy is not None else 0.0,
                    total_inferences=1,
                    avg_latency_ms=latency_ms,
                    min_latency_ms=latency_ms,
                    max_latency_ms=latency_ms,
                    timestamp=datetime.utcnow(),
                    accuracies=[accuracy] if accuracy is not None else []
                )
                
                result = await self.collection.insert_one(record.model_dump())
                return str(result.inserted_id)
                
        except Exception as e:
            logger.error("Failed to record ML inference", error=str(e))
            raise
    
    async def get_aggregated_stats(self) -> Dict[str, Any]:
        """
        Get aggregated ML statistics across all models
        
        Returns:
            Aggregated metrics (anonymous)
        """
        try:
            pipeline = [
                {
                    "$group": {
                        "_id": None,
                        "total_inferences": {"$sum": "$total_inferences"},
                        "avg_latency_ms": {"$avg": "$avg_latency_ms"},
                        "min_latency_ms": {"$min": "$min_latency_ms"},
                        "max_latency_ms": {"$max": "$max_latency_ms"}
                    }
                }
            ]
            
            result = await self.collection.aggregate(pipeline).to_list(length=1)
            
            if result:
                return {
                    "total_inferences": result[0].get("total_inferences", 0),
                    "avg_latency_ms": round(result[0].get("avg_latency_ms", 0.0), 2),
                    "min_latency_ms": round(result[0].get("min_latency_ms", 0.0), 2),
                    "max_latency_ms": round(result[0].get("max_latency_ms", 0.0), 2)
                }
            
            return {
                "total_inferences": 0,
                "avg_latency_ms": 0.0,
                "min_latency_ms": 0.0,
                "max_latency_ms": 0.0
            }
            
        except Exception as e:
            logger.error("Failed to get aggregated stats", error=str(e))
            return {
                "total_inferences": 0,
                "avg_latency_ms": 0.0,
                "min_latency_ms": 0.0,
                "max_latency_ms": 0.0
            }
    
    async def get_latest_ml_stats(self) -> Optional[Dict[str, Any]]:
        """
        Get latest ML statistics for the most recent model version
        
        Returns:
            Latest ML stats or None
        """
        try:
            stats = await self.collection.find_one(
                {},
                sort=[("timestamp", DESCENDING)]
            )
            
            if stats:
                # Calculate average accuracy from accuracies array
                accuracies = stats.get("accuracies", [])
                avg_accuracy = sum(accuracies) / len(accuracies) if accuracies else stats.get("accuracy", 0.0)
                
                return {
                    "model_version": stats.get("model_version", "unknown"),
                    "accuracy": round(avg_accuracy, 2),
                    "predictions_count": stats.get("total_inferences", 0),
                    "last_trained": stats.get("last_trained"),
                    "avg_latency_ms": round(stats.get("avg_latency_ms", 0.0), 2)
                }
            
            return None
            
        except Exception as e:
            logger.error("Failed to get latest ML stats", error=str(e))
            return None
    
    async def get_performance_history(
        self,
        model_version: str,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Get ML performance history for a specific model
        
        Args:
            model_version: Model version to query
            days: Number of days of history
            
        Returns:
            List of performance snapshots (anonymous)
        """
        try:
            # For now, return the current stats as a single point
            # In production, you'd store daily snapshots
            stats = await self.collection.find_one({"model_version": model_version})
            
            if stats:
                # Calculate average accuracy from accuracies array
                accuracies = stats.get("accuracies", [])
                avg_accuracy = sum(accuracies) / len(accuracies) if accuracies else stats.get("accuracy", 0.0)
                
                return [{
                    "date": stats.get("timestamp").isoformat() if stats.get("timestamp") else datetime.utcnow().isoformat(),
                    "accuracy": round(avg_accuracy, 2),
                    "latency_ms": round(stats.get("avg_latency_ms", 0.0), 2),
                    "inferences": stats.get("total_inferences", 0)
                }]
            
            return []
            
        except Exception as e:
            logger.error("Failed to get performance history", error=str(e))
            return []


class DailyStatisticsRepository:
    """
    Daily Statistics Repository (ANONYMOUS AGGREGATES ONLY)
    
    Tracks daily aggregate metrics without user/wallet data.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["daily_statistics"]
    
    async def update_daily_stats(
        self,
        ml_inferences: int = 0
    ) -> str:
        """
        Update daily statistics (anonymous aggregates only)
        
        Args:
            ml_inferences: Number of ML inferences to add
            
        Returns:
            Document ID
        """
        try:
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Update or create today's stats
            result = await self.collection.update_one(
                {"date": today},
                {
                    "$inc": {"total_ml_inferences": ml_inferences},
                    "$set": {"updated_at": datetime.utcnow()},
                    "$setOnInsert": {"created_at": datetime.utcnow()}
                },
                upsert=True
            )
            
            return str(result.upserted_id) if result.upserted_id else "updated"
            
        except Exception as e:
            logger.error("Failed to update daily stats", error=str(e))
            raise
    
    async def get_latest_daily_stats(self) -> Optional[Dict[str, Any]]:
        """
        Get latest daily statistics
        
        Returns:
            Latest daily stats or None
        """
        try:
            stats = await self.collection.find_one(
                {},
                sort=[("date", DESCENDING)]
            )
            
            if stats:
                return {
                    "date": stats.get("date"),
                    "total_ml_inferences": stats.get("total_ml_inferences", 0),
                    "avg_latency_ms": stats.get("avg_latency_ms", 0.0)
                }
            
            return None
            
        except Exception as e:
            logger.error("Failed to get latest daily stats", error=str(e))
            return None
