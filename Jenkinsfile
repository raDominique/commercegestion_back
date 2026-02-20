pipeline {
    agent any

    environment {
        IMAGE_NAME = "api-etokisana"
        IMAGE_TAG  = "${BUILD_NUMBER}"
        CONTAINER  = "api-etokisana"
        PORT       = "4243"
        NODE_ENV   = "production"

        // Volumes persistants host
        UPLOAD_PATH_HOST = "/var/data/api-etokisana/upload"
        LOG_PATH_HOST    = "/var/data/api-etokisana/logs"

        // Credentials Jenkins
        MONGO_URI          = credentials('MONGO_URI_ETOKISANA')
        JWT_SECRET         = credentials('JWT_SECRET')
        JWT_REFRESH_SECRET = credentials('JWT_SECRET')
        SMTP_HOST          = credentials('SMTP_HOST_HIQAODY')
        SMTP_PORT          = credentials('SMTP_PORT_HIQAODY')
        SMTP_USER          = credentials('SMTP_USER_HIQAODY')
        SMTP_PASS          = credentials('SMTP_PASS_HIQAODY')

        // Config App
        JWT_EXPIRES_IN         = "15m"
        JWT_REFRESH_EXPIRES_IN = "7d"
        SMTP_FROM              = "hiqaody@gmail.com"
        APP_NAME               = "CommerceGestion"
        APP_URL                = "https://api-etokisana.tsirylab.com"
        ADMIN_EMAIL            = "randrianomenjanaharyjacquinot@gmail.com"
        CORS_ALLOWLIST         = "http://localhost:3000,https://api-etokisana.tsirylab.com"
        FRONTEND_URL           = "http://localhost:3000"
        SUPERADMIN_EMAIL       = "superadmin@commercegestion.com"
        SUPERADMIN_PASSWORD    = "SuperSecurePassword2026!"
    }

    stages {

        stage('Prepare Host Directories') {
            steps {
                sh '''
                sudo mkdir -p $UPLOAD_PATH_HOST
                sudo mkdir -p $LOG_PATH_HOST

                # UID 1000 correspond généralement à l'user non-root Alpine
                sudo chown -R 1000:1000 /var/data/api-etokisana
                sudo chmod -R 755 /var/data/api-etokisana
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $IMAGE_NAME:$IMAGE_TAG .'
            }
        }

        stage('Stop Old Container') {
            steps {
                sh 'docker rm -f $CONTAINER || true'
            }
        }

        stage('Run Container') {
            steps {
                sh '''
                docker run -d \
                    --restart unless-stopped \
                    --name "$CONTAINER" \
                    -p "$PORT:$PORT" \
                    -e NODE_ENV="$NODE_ENV" \
                    -e PORT="$PORT" \
                    -e MONGO_URI="$MONGO_URI" \
                    -e JWT_SECRET="$JWT_SECRET" \
                    -e JWT_EXPIRES_IN="$JWT_EXPIRES_IN" \
                    -e JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
                    -e JWT_REFRESH_EXPIRES_IN="$JWT_REFRESH_EXPIRES_IN" \
                    -e SMTP_HOST="$SMTP_HOST" \
                    -e SMTP_PORT="$SMTP_PORT" \
                    -e SMTP_USER="$SMTP_USER" \
                    -e SMTP_PASS="$SMTP_PASS" \
                    -e SMTP_FROM="$SMTP_FROM" \
                    -e APP_NAME="$APP_NAME" \
                    -e APP_URL="$APP_URL" \
                    -e ADMIN_EMAIL="$ADMIN_EMAIL" \
                    -e CORS_ALLOWLIST="$CORS_ALLOWLIST" \
                    -e FRONTEND_URL="$FRONTEND_URL" \
                    -e SUPERADMIN_EMAIL="$SUPERADMIN_EMAIL" \
                    -e SUPERADMIN_PASSWORD="$SUPERADMIN_PASSWORD" \
                    --log-driver json-file \
                    --log-opt max-size=10m \
                    --log-opt max-file=5 \
                    -v "$UPLOAD_PATH_HOST:/app/upload" \
                    -v "$LOG_PATH_HOST:/var/log/api-etokisana" \
                    "$IMAGE_NAME:$IMAGE_TAG"
                '''
            }
        }

        stage('Docker Cleanup (Optional)') {
            steps {
                sh 'docker image prune -f'
            }
        }
    }

    post {
        success {
            echo 'Déploiement terminé avec succès.'
        }
        failure {
            echo 'Échec critique du déploiement.'
        }
        always {
            cleanWs()
        }
    }
}