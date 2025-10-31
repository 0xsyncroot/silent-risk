"""
WebSocket Connection Manager

Manages WebSocket connections and broadcasts updates.
JSON-based protocol for easy maintenance.
"""

import logging
import json
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections and broadcasts updates
    
    Architecture:
    - Clients subscribe to specific task_ids
    - Server broadcasts updates to subscribers
    - Automatic cleanup on disconnect
    """
    
    def __init__(self):
        # Map: task_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Map: WebSocket -> set of task_ids it's subscribed to
        self.connection_subscriptions: Dict[WebSocket, Set[str]] = {}
    
    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.connection_subscriptions[websocket] = set()
        logger.info(f"WebSocket connected: {id(websocket)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection and clean up subscriptions"""
        if websocket in self.connection_subscriptions:
            task_ids = self.connection_subscriptions[websocket].copy()
            for task_id in task_ids:
                self._unsubscribe(websocket, task_id)
            del self.connection_subscriptions[websocket]
        
        logger.info(f"WebSocket disconnected: {id(websocket)}")
    
    def _subscribe(self, websocket: WebSocket, task_id: str):
        """Subscribe a WebSocket to task updates"""
        if task_id not in self.active_connections:
            self.active_connections[task_id] = set()
        
        self.active_connections[task_id].add(websocket)
        self.connection_subscriptions[websocket].add(task_id)
        
        logger.debug(f"WebSocket {id(websocket)} subscribed to task {task_id}")
    
    def _unsubscribe(self, websocket: WebSocket, task_id: str):
        """Unsubscribe a WebSocket from task updates"""
        if task_id in self.active_connections:
            self.active_connections[task_id].discard(websocket)
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]
        
        if websocket in self.connection_subscriptions:
            self.connection_subscriptions[websocket].discard(task_id)
        
        logger.debug(f"WebSocket {id(websocket)} unsubscribed from task {task_id}")
    
    async def handle_message(self, websocket: WebSocket, message: str):
        """
        Handle incoming message from client
        
        Expected format:
        {
            "type": "subscribe" | "unsubscribe",
            "task_id": "uuid"
        }
        """
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            task_id = data.get("task_id")
            
            if not msg_type or not task_id:
                await self.send_error(
                    websocket, 
                    "Invalid message format. Required: type, task_id"
                )
                return
            
            if msg_type == "subscribe":
                self._subscribe(websocket, task_id)
                await self.send_message(websocket, {
                    "type": "subscribed",
                    "task_id": task_id,
                    "message": f"Successfully subscribed to task {task_id}"
                })
            
            elif msg_type == "unsubscribe":
                self._unsubscribe(websocket, task_id)
                await self.send_message(websocket, {
                    "type": "unsubscribed",
                    "task_id": task_id,
                    "message": f"Successfully unsubscribed from task {task_id}"
                })
            
            else:
                await self.send_error(
                    websocket,
                    f"Unknown message type: {msg_type}"
                )
        
        except json.JSONDecodeError:
            await self.send_error(websocket, "Invalid JSON format")
        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)
            await self.send_error(websocket, f"Internal error: {str(e)}")
    
    async def send_message(self, websocket: WebSocket, message: dict):
        """Send JSON message to a specific WebSocket"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending message: {e}")
    
    async def send_error(self, websocket: WebSocket, error: str):
        """Send error message to a specific WebSocket"""
        await self.send_message(websocket, {
            "type": "error",
            "error": error
        })
    
    async def broadcast_status_update(self, task_id: str, status_data: dict):
        """
        Broadcast status update to all subscribers of a task
        
        Args:
            task_id: Task identifier
            status_data: Status data (status, progress, message, etc.)
        """
        if task_id not in self.active_connections:
            logger.debug(f"No subscribers for task {task_id}")
            return
        
        message = {
            "type": "status_update",
            "task_id": task_id,
            "data": status_data
        }
        
        # Broadcast to all subscribers
        disconnected = []
        for websocket in self.active_connections[task_id].copy():
            try:
                await self.send_message(websocket, message)
            except Exception as e:
                logger.error(f"Error broadcasting to websocket: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected websockets
        for websocket in disconnected:
            self.disconnect(websocket)
        
        logger.debug(
            f"Broadcasted status update for task {task_id} to "
            f"{len(self.active_connections.get(task_id, []))} clients"
        )
    
    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "total_connections": len(self.connection_subscriptions),
            "total_subscriptions": sum(
                len(subs) for subs in self.connection_subscriptions.values()
            ),
            "tasks_with_subscribers": len(self.active_connections),
            "connections_per_task": {
                task_id: len(connections)
                for task_id, connections in self.active_connections.items()
            }
        }


# Global instance
connection_manager = ConnectionManager()

