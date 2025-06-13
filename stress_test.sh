#!/bin/bash

# A comprehensive stress test script for the AI Orchestrator.
# Submits 20 tasks in quick succession to test parallel processing and the task queue.

echo "Starting AI Orchestrator Stress Test..."

# --- Submit 20 diverse tasks in the background ---

echo "Submitting task 1: code_generation"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "code_generation", "payload": {"description": "Create a python class for a basic linked list."}}' &

echo "Submitting task 2: text_processing"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"text": "What is the capital of Australia?"}}' &

echo "Submitting task 3: data_analysis"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "data_analysis", "payload": {"description": "Find the average of these numbers: 15, 25, 40, 60."}}' &

echo "Submitting task 4: code_generation"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "code_generation", "payload": {"description": "JavaScript function to validate an email address."}}' &

echo "Submitting task 5: text_processing"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"text": "Summarize the concept of supply and demand."}}' &

echo "Submitting task 6: data_analysis"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "data_analysis", "payload": {"description": "Which number is an outlier in this set: 10, 12, 14, 50, 11?"}}' &

echo "Submitting task 7: text_processing" # image_analysis fallback
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"description": "Describe a picture of a golden retriever in a park."}}' &

echo "Submitting task 8: text_processing"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"text": "Who wrote the novel ''Pride and Prejudice''?"}}' &

echo "Submitting task 9: code_generation"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "code_generation", "payload": {"description": "HTML structure for a login form with username and password."}}' &

echo "Submitting task 10: data_analysis"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "data_analysis", "payload": {"description": "Calculate the percentage increase from 200 to 250."}}' &

echo "Submitting task 11: text_processing"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"text": "What are the main components of a cell?"}}' &

echo "Submitting task 12: code_generation"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "code_generation", "payload": {"description": "A simple CSS snippet to make text bold and red."}}' &

echo "Submitting task 13: data_analysis"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "data_analysis", "payload": {"description": "Given sales of [100, 150, 120, 180], what is the total?"}}' &

echo "Submitting task 14: text_processing" # image_analysis fallback
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"description": "Describe a cityscape at night."}}' &

echo "Submitting task 15: text_processing"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"text": "What is the formula for the area of a circle?"}}' &

echo "Submitting task 16: code_generation"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "code_generation", "payload": {"description": "Python function to check if a word is a palindrome."}}' &

echo "Submitting task 17: data_analysis"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "data_analysis", "payload": {"description": "What is the mode of this dataset: [A, B, C, B, D, B]?"}}' &

echo "Submitting task 18: text_processing"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"text": "Translate ''Hello, how are you?'' to French."}}' &

echo "Submitting task 19: code_generation"
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "code_generation", "payload": {"description": "A SQL query to join a ''users'' and ''orders'' table."}}' &

echo "Submitting task 20: text_processing" # image_analysis fallback
curl -s -o /dev/null -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" -d '{"type": "text_processing", "payload": {"description": "Describe a painting of a field of sunflowers."}}' &

# Wait for all background curl jobs to finish submitting
wait

echo ""
echo "All 20 tasks submitted successfully."
echo "Watch the dashboard to see the system process the queue."