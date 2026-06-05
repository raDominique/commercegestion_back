pipeline {
    agent any

    environment {
        PORT = '4243'

        DOCKER_IMAGE = 'commercegestion-api'
        DOCKER_TAG = "${BUILD_NUMBER}"
        DOCKER_CONTAINER_NAME = 'commercegestion-api'

        MONGO_URI = credentials('MONGO_URI_ETOKISANA')
        NODE_ENV = 'development'

        JWT_SECRET = credentials('JWT_SECRET_E_TAKALO')
        JWT_EXPIRES_IN = '15m'
        JWT_REFRESH_SECRET = credentials('JWT_REFRESH_SECRET_E_TAKALO')
        JWT_REFRESH_EXPIRES_IN = '7d'

        SMTP_HOST = credentials('SMTP_HOST_E_TAKALO')
        SMTP_PORT = credentials('SMTP_PORT_E_TAKALO')
        SMTP_USER = credentials('SMTP_USER_E_TAKALO')
        SMTP_PASS = credentials('SMTP_PASS_E_TAKALO')
        SMTP_FROM = credentials('SMTP_USER_E_TAKALO')

        SMTP_SECURE = 'true'
        SMTP_FROM_NAME = 'CommerceGestion'
        MAIL_SEND_DELAY_MS = '300'
        MAIL_MAX_RETRIES = '3'

        APP_NAME = 'CommerceGestion'
        APP_URL = 'https://api-e-takalo.tsirylab.com'

        ADMIN_EMAIL = credentials('ADMIN_EMAIL_E_TAKALO')

        CORS_ALLOWLIST = 'http://localhost:3000,http://localhost:4200,https://commercegestion.com,https://www.commercegestion.com'
        FRONTEND_URL = 'https://commercegestion.com'
        FRONT_URL = 'https://commercegestion.com'

        SUPERADMIN_EMAIL = credentials('SUPERADMIN_EMAIL_E_TAKALO')
        SUPERADMIN_PASSWORD = credentials('SUPERADMIN_PASSWORD_E_TAKALO')
    }

    stages {

        stage('Build Docker Image') {
            steps {
                sh """
                docker build \
                    --build-arg NODE_ENV=${NODE_ENV} \
                    --build-arg PORT=${PORT} \
                    -t ${DOCKER_IMAGE}:${DOCKER_TAG} .
                """
            }
        }

        stage('Deploy with Rollback') {
            steps {
                script {

                    sh """
                    # Sauvegarde de l'ancien conteneur
                    if docker ps -a --format '{{.Names}}' | grep -w ${DOCKER_CONTAINER_NAME}; then

                        docker rm -f ${DOCKER_CONTAINER_NAME}_backup 2>/dev/null || true

                        docker stop ${DOCKER_CONTAINER_NAME} || true

                        docker rename \
                            ${DOCKER_CONTAINER_NAME} \
                            ${DOCKER_CONTAINER_NAME}_backup
                    fi
                    """

                    sh """
                    docker run -d \
                        --name ${DOCKER_CONTAINER_NAME} \
                        -p ${PORT}:${PORT} \
                        -e PORT=${PORT} \
                        -e MONGO_URI="${MONGO_URI}" \
                        -e NODE_ENV="${NODE_ENV}" \
                        -e JWT_SECRET="${JWT_SECRET}" \
                        -e JWT_EXPIRES_IN="${JWT_EXPIRES_IN}" \
                        -e JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}" \
                        -e JWT_REFRESH_EXPIRES_IN="${JWT_REFRESH_EXPIRES_IN}" \
                        -e SMTP_HOST="${SMTP_HOST}" \
                        -e SMTP_PORT="${SMTP_PORT}" \
                        -e SMTP_USER="${SMTP_USER}" \
                        -e SMTP_PASS="${SMTP_PASS}" \
                        -e SMTP_FROM="${SMTP_FROM}" \
                        -e SMTP_SECURE="${SMTP_SECURE}" \
                        -e SMTP_FROM_NAME="${SMTP_FROM_NAME}" \
                        -e MAIL_SEND_DELAY_MS="${MAIL_SEND_DELAY_MS}" \
                        -e MAIL_MAX_RETRIES="${MAIL_MAX_RETRIES}" \
                        -e APP_NAME="${APP_NAME}" \
                        -e APP_URL="${APP_URL}" \
                        -e ADMIN_EMAIL="${ADMIN_EMAIL}" \
                        -e CORS_ALLOWLIST="${CORS_ALLOWLIST}" \
                        -e FRONTEND_URL="${FRONTEND_URL}" \
                        -e FRONT_URL="${FRONT_URL}" \
                        -e SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL}" \
                        -e SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD}" \
                        ${DOCKER_IMAGE}:${DOCKER_TAG}
                    """

                    sh """
                    sleep 15

                    if docker ps --format '{{.Names}}' | grep -w ${DOCKER_CONTAINER_NAME}; then
                        echo "Déploiement réussi"

                        docker rm -f ${DOCKER_CONTAINER_NAME}_backup 2>/dev/null || true

                    else
                        echo "Déploiement échoué - Rollback"

                        docker rm -f ${DOCKER_CONTAINER_NAME} 2>/dev/null || true

                        if docker ps -a --format '{{.Names}}' | grep -w ${DOCKER_CONTAINER_NAME}_backup; then
                            docker rename \
                                ${DOCKER_CONTAINER_NAME}_backup \
                                ${DOCKER_CONTAINER_NAME}

                            docker start ${DOCKER_CONTAINER_NAME}

                            echo "Rollback effectué"
                            exit 1
                        else
                            echo "Aucun backup disponible"
                            exit 1
                        fi
                    fi
                    """
                }
            }
        }
    }

    post {
        always {
            sh """
            docker image prune -f || true
            """
        }
    }
}