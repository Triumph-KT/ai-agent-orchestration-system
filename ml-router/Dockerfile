# Use an official Python 3.12 slim image. 'slim' is a good balance of size and functionality.
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the requirements file and install dependencies first for layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application, including our trained model and scripts
COPY . .

# Expose port 5001 so the container can be reached
EXPOSE 5001

# Set the FLASK_APP environment variable for the 'flask' command
ENV FLASK_APP=task_router.py

# The command to run the Flask application in production mode.
# We use '--host=0.0.0.0' to make it accessible from outside the container.
CMD ["flask", "run", "--host=0.0.0.0", "--port=5001"]