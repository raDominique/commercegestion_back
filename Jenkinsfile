pipeline {
    agent any

    environment {
        IMAGE_NAME = "api-etokisana"
        IMAGE_TAG  = "${BUILD_NUMBER}"
        CONTAINER  = "api-etokisana"

        PORT       = "4243"
        NODE_ENV   = "production"

        MONGO_URI  = credentials('MONGO_URI_ETOKISANA')
        // JWT Configuration
        JWT_SECRET = credentials('JWT_SECRET')
        JWT_EXPIRES_IN="15m"
        JWT_REFRESH_SECRET=credentials('JWT_SECRET')
        JWT_REFRESH_EXPIRES_IN="7d"

        // SMTP Configuration
        SMTP_HOST=credentials('SMTP_HOST_HIQAODY')
        SMTP_PORT=credentials('SMTP_PORT_HIQAODY')
        SMTP_USER=credentials('SMTP_USER_HIQAODY')
        SMTP_PASS=credentials('SMTP_PASS_HIQAODY')
        SMTP_FROM=credentials('SMTP_USER_HIQAODY')
        // Application Configuration
        APP_NAME = "CommerceGestion"
        APP_URL = "https://api-etokisana.tsirylab.com"
        // Admin Email
        ADMIN_EMAIL = "randrianomenjanaharyjacquinot@gmail.com"

        // CORS Configuration
        CORS_ALLOWLIST = "http://localhost:3000,http://localhost:4200"
        FRONTEND_URL = "http://localhost:3000"
    }

    stages {

        stage('Build image') {
            steps {
                sh '''
                docker build -t $IMAGE_NAME:$IMAGE_TAG .
                '''
            }
        }

        stage('Stop old container') {
            steps {
                sh '''
                docker rm -f $CONTAINER || true
                '''
            }
        }

        stage('Run container (PROD)') {
            steps {
                sh '''
                docker run -d \
                    --restart unless-stopped \
                    --name $CONTAINER \
                    -p $PORT:$PORT \
                    -e NODE_ENV=$NODE_ENV \
                    -e PORT=$PORT \
                    -e MONGO_URI=$MONGO_URI \
                    -e JWT_SECRET=$JWT_SECRET \
                    -e JWT_EXPIRES_IN=$JWT_EXPIRES_IN \
                    -e JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET \
                    -e JWT_REFRESH_EXPIRES_IN=$JWT_REFRESH_EXPIRES_IN \
                    -e SMTP_HOST=$SMTP_HOST \
                    -e SMTP_PORT=$SMTP_PORT \
                    -e SMTP_USER=$SMTP_USER \
                    -e SMTP_PASS=$SMTP_PASS \
                    -e SMTP_FROM=$SMTP_FROM \
                    -e APP_NAME=$APP_NAME \
                    -e APP_URL=$APP_URL \
                    -e ADMIN_EMAIL=$ADMIN_EMAIL \
                    -e CORS_ALLOWLIST=$CORS_ALLOWLIST \
                    -e FRONTEND_URL=$FRONTEND_URL \
                    --log-driver json-file \
                    --log-opt max-size=10m \
                    --log-opt max-file=5 \
                    $IMAGE_NAME:$IMAGE_TAG
                '''
            }
        }
    }

    post {
        success {
            echo 'Production déployée avec succès'
        }
        failure {
            echo 'Échec du déploiement PROD'
        }
        always {
            echo 'Cleaning workspace...'
            cleanWs()
        }
    }
}
