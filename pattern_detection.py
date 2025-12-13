"""
Pattern Detection Engine for Goal Tracker
Analyzes user behavioral data to find correlations and insights

Author: Pattern Analytics Module
Purpose: Extract actionable insights from habit tracking data
"""

import numpy as np
from scipy import stats
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import json


@dataclass
class PatternInsight:
    """Structured insight from data analysis"""
    category: str  # 'sleep', 'time_of_day', 'day_of_week', 'mood', 'streak'
    finding: str   # Human-readable insight
    confidence: float  # 0-1, how confident we are
    recommendation: str  # What to do about it
    data_point: float  # Supporting metric
    

class PatternDetector:
    """Core pattern detection engine"""
    
    def __init__(self, min_data_points: int = 5):
        """
        Args:
            min_data_points: Minimum days of data needed for valid correlation
        """
        self.min_data_points = min_data_points
        self.insights: List[PatternInsight] = []
    
    def analyze_sleep_impact(self, daily_logs: Dict[int, Dict]) -> PatternInsight:
        """
        Find correlation between sleep duration and next-day habit completion
        
        Args:
            daily_logs: {day: {sleepDuration, ...}, ...}
        
        Returns:
            PatternInsight object
        """
        sleep_data = []
        completion_data = []
        days_with_sleep = []
        
        # Collect sleep and completion data
        for day, log in sorted(daily_logs.items()):
            if log.get('sleepDuration'):
                sleep_data.append(log['sleepDuration'])
                days_with_sleep.append(day)
                completion_data.append(log.get('dailyCompletionRate', 0))
        
        if len(sleep_data) < self.min_data_points:
            return PatternInsight(
                category='sleep',
                finding='Not enough sleep data yet',
                confidence=0.0,
                recommendation='Log sleep for 5+ days to see patterns',
                data_point=0
            )
        
        # Calculate Pearson correlation
        correlation, p_value = stats.pearsonr(sleep_data, completion_data)
        
        # Interpret correlation
        if p_value > 0.05:  # Not statistically significant
            confidence = 0.3
            finding = "Sleep and completion don't show clear correlation yet"
            recommendation = "Continue tracking to build a pattern"
        elif correlation > 0.5:
            confidence = 0.9
            finding = f"Strong pattern: Better sleep → Better completion ({correlation:.1%} correlation)"
            recommendation = "Prioritize 7-8 hours sleep—it's your biggest productivity lever"
            data_point = correlation
        elif correlation > 0.3:
            confidence = 0.7
            finding = f"Moderate link: More sleep helps completion ({correlation:.1%} correlation)"
            recommendation = "Try aiming for 7 hours sleep on goal days"
            data_point = correlation
        else:
            confidence = 0.5
            finding = "Sleep variation doesn't strongly affect your completion"
            recommendation = "Focus on other factors (time of day, habit design)"
            data_point = correlation
        
        return PatternInsight(
            category='sleep',
            finding=finding,
            confidence=confidence,
            recommendation=recommendation,
            data_point=correlation
        )
    
    def analyze_day_of_week(self, daily_logs: Dict[int, Dict], 
                           num_days_in_month: int) -> PatternInsight:
        """
        Find which days of week you're most productive
        
        Args:
            daily_logs: {day: {...}, ...}
            num_days_in_month: Days in current month
        
        Returns:
            PatternInsight object
        """
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        completion_by_dow = defaultdict(list)
        
        # Get a reference date (assume current month)
        today = datetime.now()
        month_start = datetime(today.year, today.month, 1)
        
        # Bucket completions by day of week
        for day, log in daily_logs.items():
            if day <= num_days_in_month:
                day_date = datetime(today.year, today.month, day)
                dow = day_date.weekday()  # 0=Monday, 6=Sunday
                completion_rate = log.get('dailyCompletionRate', 0)
                completion_by_dow[dow].append(completion_rate)
        
        if not completion_by_dow or all(len(v) < 2 for v in completion_by_dow.values()):
            return PatternInsight(
                category='day_of_week',
                finding='Not enough data across different days yet',
                confidence=0.2,
                recommendation='Track for 3-4 weeks to identify your peak days',
                data_point=0
            )
        
        # Calculate average by day of week
        avg_by_dow = {dow: np.mean(rates) for dow, rates in completion_by_dow.items()}
        best_dow = max(avg_by_dow, key=avg_by_dow.get)
        worst_dow = min(avg_by_dow, key=avg_by_dow.get)
        
        best_day_name = day_names[best_dow]
        worst_day_name = day_names[worst_dow]
        diff = avg_by_dow[best_dow] - avg_by_dow[worst_dow]
        
        if diff > 0.3:  # 30%+ difference
            confidence = 0.85
            finding = f"You crush it on {best_day_name}s (+{diff:.0%} vs {worst_day_name}s)"
            recommendation = f"Schedule hard goals for {best_day_name}s, break smaller goals on {worst_day_name}s"
            data_point = diff
        elif diff > 0.1:
            confidence = 0.6
            finding = f"Slight edge on {best_day_name}s (+{diff:.0%} completion)"
            recommendation = f"Notice the pattern; lean into {best_day_name} momentum"
            data_point = diff
        else:
            confidence = 0.4
            finding = "Your performance is consistent across the week"
            recommendation = "Focus on other variables (sleep, time of day, habit type)"
            data_point = 0
        
        return PatternInsight(
            category='day_of_week',
            finding=finding,
            confidence=confidence,
            recommendation=recommendation,
            data_point=diff
        )
    
    def analyze_time_of_day(self, daily_logs: Dict[int, Dict]) -> PatternInsight:
        """
        Find your peak productivity hours
        
        Args:
            daily_logs: {day: {hourlyData: {8: [completed], 10: [skipped], ...}, ...}}
        
        Returns:
            PatternInsight object
        """
        # This assumes you track time when habits are logged (future enhancement)
        # For now, return placeholder
        
        return PatternInsight(
            category='time_of_day',
            finding='Not implemented yet—log habit times for time-of-day analysis',
            confidence=0.0,
            recommendation='In next version, track when you complete habits (morning/afternoon/evening)',
            data_point=0
        )
    
    def analyze_mood_correlation(self, daily_logs: Dict[int, Dict]) -> PatternInsight:
        """
        Correlate mood with habit completion
        
        Args:
            daily_logs: {day: {mood: 'happy'|'neutral'|'sad', dailyCompletionRate: 0.8, ...}}
        
        Returns:
            PatternInsight object
        """
        mood_scores = {'sad': 1, 'neutral': 2, 'happy': 3}
        mood_data = []
        completion_data = []
        
        for day, log in daily_logs.items():
            mood = log.get('mood')
            if mood and mood in mood_scores:
                mood_data.append(mood_scores[mood])
                completion_data.append(log.get('dailyCompletionRate', 0))
        
        if len(mood_data) < self.min_data_points:
            return PatternInsight(
                category='mood',
                finding='Log your mood for 5+ days to reveal patterns',
                confidence=0.0,
                recommendation='Use the mood selector daily (takes 1 second)',
                data_point=0
            )
        
        correlation, p_value = stats.pearsonr(mood_data, completion_data)
        
        if correlation > 0.4 and p_value < 0.05:
            confidence = 0.8
            finding = f"Your mood strongly predicts completion ({correlation:.1%} correlation)"
            recommendation = "Focus on mood management—small wins, wins on what you can control"
            data_point = correlation
        elif correlation > 0.2:
            confidence = 0.6
            finding = f"Better mood correlates with better completion ({correlation:.1%})"
            recommendation = "Pre-game with 5 min of your favorite music/video"
            data_point = correlation
        else:
            confidence = 0.4
            finding = "Mood doesn't strongly predict your completion"
            recommendation = "Your discipline is independent of mood—leverage that!"
            data_point = correlation
        
        return PatternInsight(
            category='mood',
            finding=finding,
            confidence=confidence,
            recommendation=recommendation,
            data_point=correlation
        )
    
    def analyze_habit_difficulty(self, habits: List[Dict], 
                                daily_logs: Dict[int, Dict],
                                num_days: int) -> List[PatternInsight]:
        """
        Rank habits by difficulty (completion %) and find patterns
        
        Args:
            habits: [{id, name, completed: [days]}, ...]
            daily_logs: {...}
            num_days: Days in month
        
        Returns:
            List of PatternInsights (one per habit tier)
        """
        habit_stats = []
        
        for habit in habits:
            completion_pct = len(habit.get('completed', [])) / num_days if num_days > 0 else 0
            habit_stats.append({
                'name': habit['name'],
                'completion': completion_pct,
                'count': len(habit.get('completed', []))
            })
        
        habit_stats.sort(key=lambda x: x['completion'], reverse=True)
        
        insights = []
        
        if habit_stats:
            # Easy habits (>80%)
            easy = [h for h in habit_stats if h['completion'] > 0.8]
            if easy:
                insight = PatternInsight(
                    category='habits_easy',
                    finding=f"These are locked in: {', '.join(h['name'] for h in easy[:2])}",
                    confidence=0.9,
                    recommendation='Build on momentum—add 1 new habit from these',
                    data_point=0
                )
                insights.append(insight)
            
            # Medium habits (40-80%)
            medium = [h for h in habit_stats if 0.4 <= h['completion'] <= 0.8]
            if medium:
                insight = PatternInsight(
                    category='habits_medium',
                    finding=f"These need attention: {', '.join(h['name'] for h in medium[:2])}",
                    confidence=0.85,
                    recommendation='Break these into smaller steps or shift timing',
                    data_point=0
                )
                insights.append(insight)
            
            # Hard habits (<40%)
            hard = [h for h in habit_stats if h['completion'] < 0.4]
            if hard:
                insight = PatternInsight(
                    category='habits_hard',
                    finding=f"Struggling with: {', '.join(h['name'] for h in hard[:2])}",
                    confidence=0.9,
                    recommendation='Consider removing or simplifying—consistency beats ambition',
                    data_point=0
                )
                insights.append(insight)
        
        return insights
    
    def find_anomalies(self, daily_logs: Dict[int, Dict], 
                      habits: List[Dict]) -> PatternInsight:
        """
        Find unusual days (big drops, perfect days, etc.)
        
        Args:
            daily_logs: {...}
            habits: [...]
        
        Returns:
            PatternInsight about anomalies
        """
        if not daily_logs:
            return None
        
        completion_rates = [log.get('dailyCompletionRate', 0) for log in daily_logs.values()]
        if len(completion_rates) < 3:
            return None
        
        mean = np.mean(completion_rates)
        std = np.std(completion_rates)
        
        # Find outliers (>1.5 std from mean)
        anomaly_days = []
        for day, log in daily_logs.items():
            rate = log.get('dailyCompletionRate', 0)
            if abs(rate - mean) > 1.5 * std:
                anomaly_days.append((day, rate))
        
        if not anomaly_days:
            return None
        
        best_day = max(anomaly_days, key=lambda x: x[1])
        worst_day = min(anomaly_days, key=lambda x: x[1])
        
        finding = f"Day {best_day[0]} was exceptional (+{(best_day[1]-mean):.0%})"
        recommendation = "What was different? Sleep? Timing? Energy? Recreate that."
        
        return PatternInsight(
            category='anomaly',
            finding=finding,
            confidence=0.7,
            recommendation=recommendation,
            data_point=best_day[1]
        )
    
    def run_full_analysis(self, daily_logs: Dict[int, Dict], 
                         habits: List[Dict],
                         num_days_in_month: int) -> Dict[str, Any]:
        """
        Run all analyses and return comprehensive report
        
        Args:
            daily_logs: {day: {sleepDuration, mood, chatHistory, ...}, ...}
            habits: [{id, name, completed: [days]}, ...]
            num_days_in_month: Days in month
        
        Returns:
            {
                'insights': [PatternInsight, ...],
                'summary': str,
                'top_recommendation': str
            }
        """
        # Calculate daily completion rates
        daily_logs_enriched = {}
        for day, log in daily_logs.items():
            # This assumes you pass habit completion data
            # Or calculate from habits directly
            daily_logs_enriched[day] = log
        
        insights = []
        
        # Run all analyses
        sleep_insight = self.analyze_sleep_impact(daily_logs_enriched)
        insights.append(sleep_insight)
        
        dow_insight = self.analyze_day_of_week(daily_logs_enriched, num_days_in_month)
        insights.append(dow_insight)
        
        mood_insight = self.analyze_mood_correlation(daily_logs_enriched)
        insights.append(mood_insight)
        
        # Habit difficulty
        habit_insights = self.analyze_habit_difficulty(habits, daily_logs_enriched, num_days_in_month)
        insights.extend(habit_insights)
        
        # Anomalies
        anomaly_insight = self.find_anomalies(daily_logs_enriched, habits)
        if anomaly_insight:
            insights.append(anomaly_insight)
        
        # Filter high-confidence insights
        high_confidence = [i for i in insights if i.confidence >= 0.6]
        high_confidence.sort(key=lambda x: x.confidence, reverse=True)
        
        # Generate summary
        top_3 = high_confidence[:3]
        summary = "\n".join([f"• {i.finding}" for i in top_3])
        
        top_rec = top_3[0].recommendation if top_3 else "Continue tracking to build patterns"
        
        return {
            'insights': high_confidence,
            'summary': summary,
            'top_recommendation': top_rec,
            'total_data_points': len(daily_logs),
            'confidence_score': np.mean([i.confidence for i in high_confidence]) if high_confidence else 0
        }


# Example usage
if __name__ == "__main__":
    # Mock data
    daily_logs = {
        1: {'sleepDuration': 450, 'mood': 'happy', 'dailyCompletionRate': 1.0},
        2: {'sleepDuration': 420, 'mood': 'happy', 'dailyCompletionRate': 1.0},
        3: {'sleepDuration': 300, 'mood': 'sad', 'dailyCompletionRate': 0.5},
        4: {'sleepDuration': 480, 'mood': 'happy', 'dailyCompletionRate': 0.8},
        5: {'sleepDuration': 390, 'mood': 'neutral', 'dailyCompletionRate': 0.6},
        6: {'sleepDuration': 450, 'mood': 'happy', 'dailyCompletionRate': 1.0},
        7: {'sleepDuration': 360, 'mood': 'sad', 'dailyCompletionRate': 0.4},
    }
    
    habits = [
        {'id': '1', 'name': 'LeetCode', 'completed': [1, 2, 4, 6]},
        {'id': '2', 'name': 'Reading', 'completed': [1, 2, 3, 4, 5, 6, 7]},
        {'id': '3', 'name': 'Gym', 'completed': [2, 4]},
    ]
    
    detector = PatternDetector()
    report = detector.run_full_analysis(daily_logs, habits, 31)
    
    print("=== Pattern Analysis Report ===")
    print(report['summary'])
    print(f"\nTop Recommendation: {report['top_recommendation']}")
    print(f"Overall Confidence: {report['confidence_score']:.0%}")
