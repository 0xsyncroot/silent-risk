/**
 * ML Performance Component
 * 
 * Displays Concrete-ML model performance metrics:
 * - Model accuracy
 * - Total inferences (encrypted computations)
 * - Average latency
 * - Performance history chart
 * 
 * Architecture:
 * - State: Zustand store (analytics.store.ts)
 * - API: AnalyticsService (services/analytics.service.ts)
 * - Auto-refresh: Every 2 minutes
 */

'use client';

import { useEffect, useCallback } from 'react';
import { Brain, Zap, Lock, TrendingUp, Activity } from 'lucide-react';
import { AnalyticsService } from '@/lib/api/services';
import type { MLPerformanceData } from '@/lib/api/services/analytics.service';
import { useState } from 'react';

interface MLStatsDisplay extends MLPerformanceData {
  averageLatency: number;
  modelVersion: string;
  lastUpdated: string;
}

export function MLPerformance() {
  const [mlStats, setMLStats] = useState<MLStatsDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch ML performance statistics
   */
  const fetchMLStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await AnalyticsService.getMLStats();
      setMLStats({
        ...data,
        averageLatency: data.avg_latency_ms || 0,
        modelVersion: data.model_version,
        lastUpdated: data.last_trained
      });
    } catch (err: unknown) {
      console.error('Failed to fetch ML stats:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load ML statistics';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchMLStats();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchMLStats, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMLStats]);

  // Loading state
  if (loading && !mlStats) {
    return (
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="card p-6">
            <div className="loading-shimmer h-6 w-1/3 mb-4 rounded"></div>
            <div className="loading-shimmer h-32 w-full rounded"></div>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error && !mlStats) {
    return (
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center py-16">
            <Brain className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Failed to Load ML Stats</h3>
            <p className="text-slate-600 mb-4">{error}</p>
            <button onClick={fetchMLStats} className="btn-primary">
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  // No data
  if (!mlStats) {
    return null;
  }

  return (
    <section className="py-12 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full mb-4">
            <Brain className="w-3 h-3 mr-1.5" />
            CONCRETE-ML POWERED
          </div>
          <h2 className="text-h1 mb-4 text-slate-900">
            AI Model Performance
          </h2>
          <p className="text-body max-w-2xl mx-auto">
            Machine learning inference on encrypted data using Concrete-ML and fhEVM technology
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Model Stats */}
          <div className="space-y-4">
            {/* Accuracy */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-green-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-xs font-medium text-green-600">Excellent</span>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-slate-900">{mlStats.accuracy.toFixed(1)}%</div>
                <div className="text-sm font-medium text-slate-700">Model Accuracy</div>
                <div className="text-xs text-slate-500">Trained on encrypted data</div>
              </div>
            </div>

            {/* Total Inferences */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-purple-50 rounded-lg">
                  <Activity className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-purple-600">Active</span>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-slate-900">{mlStats.predictions_count.toLocaleString()}</div>
                <div className="text-sm font-medium text-slate-700">Total Inferences</div>
                <div className="text-xs text-slate-500">All encrypted computations</div>
              </div>
            </div>

            {/* Average Latency */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-blue-600">Fast</span>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-slate-900">{mlStats.averageLatency}ms</div>
                <div className="text-sm font-medium text-slate-700">Avg Latency</div>
                <div className="text-xs text-slate-500">FHE inference time</div>
              </div>
            </div>
          </div>

          {/* Performance History */}
          <div className="lg:col-span-2">
            <div className="card p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Performance History</h3>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-xs text-slate-600">Accuracy</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-slate-600">Latency</span>
                  </div>
                </div>
              </div>

              {/* Simple bar chart */}
              <div className="space-y-4">
                {mlStats.performanceHistory?.map((point, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{point.timestamp}</span>
                      <div className="flex items-center space-x-3">
                        <span className="text-purple-600">{point.accuracy.toFixed(1)}%</span>
                        <span className="text-blue-600">{point.latency.toFixed(0)}ms</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {/* Accuracy bar */}
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${point.accuracy}%` }}
                        ></div>
                      </div>
                      {/* Latency bar (scale 0-500ms) */}
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(point.latency / 500) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Model Info */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 mb-1">Model Version</div>
                    <div className="font-mono font-bold text-slate-900">{mlStats.modelVersion}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Last Updated</div>
                    <div className="font-medium text-slate-900">{mlStats.lastUpdated}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Encrypted Computations</div>
                    <div className="font-medium text-slate-900">{mlStats.predictions_count.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Privacy Level</div>
                    <div className="flex items-center space-x-1">
                      <Lock className="h-3 w-3 text-green-600" />
                      <span className="font-medium text-green-600">100% Private</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technology Info */}
        <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Brain className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 mb-2">Fully Homomorphic Encryption (FHE)</h4>
              <p className="text-sm text-slate-700 mb-3">
                Our ML models run directly on encrypted data using Zama&apos;s Concrete-ML framework. 
                Your sensitive information never leaves encrypted form, even during inference.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-white text-xs font-medium text-purple-700 rounded-full border border-purple-200">
                  Zama fhEVM
                </span>
                <span className="px-2 py-1 bg-white text-xs font-medium text-blue-700 rounded-full border border-blue-200">
                  Concrete-ML
                </span>
                <span className="px-2 py-1 bg-white text-xs font-medium text-green-700 rounded-full border border-green-200">
                  Zero Knowledge
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

