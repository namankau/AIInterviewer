# The API as a container. Build from apps/api:
#   docker build -t acemyinterview-api apps/api
# Configuration is entirely environment variables (see .env.example, "API" section);
# nothing secret is baked into the image.

FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN chmod +x gradlew && ./gradlew --no-daemon --quiet dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon --quiet bootJar \
 && cp build/libs/api-*[0-9].jar /app/app.jar

FROM eclipse-temurin:21-jre
RUN groupadd --system app && useradd --system --gid app app
WORKDIR /app
COPY --from=build /app/app.jar app.jar
USER app
EXPOSE 8080
# Liveness/readiness for the platform: /actuator/health/liveness and /readiness.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
