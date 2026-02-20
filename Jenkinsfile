pipeline {
    agent any

    environment {
        IMAGE_NAME = 'api-etokisana'
        IMAGE_TAG  = "${BUILD_NUMBER}"
        PORT       = '4243'
        NODE_ENV   = 'production'

        MONGO_URI          = credentials('MONGO_URI_ETOKISANA')
        JWT_SECRET         = credentials('JWT_SECRET')
        JWT_REFRESH_SECRET = credentials('JWT_REFRESH_SECRET')
        SMTP_HOST          = credentials('SMTP_HOST_HIQAODY')
        SMTP_PORT          = credentials('SMTP_PORT_HIQAODY')
        SMTP_USER          = credentials('SMTP_USER_HIQAODY')
        SMTP_PASS          = credentials('SMTP_PASS_HIQAODY')

        JWT_EXPIRES_IN         = '15m'
        JWT_REFRESH_EXPIRES_IN = '7d'
        SMTP_FROM              = 'hiqaody@gmail.com'
        APP_NAME               = 'CommerceGestion'
        APP_URL                = 'https://api-etokisana.tsirylab.com'
        ADMIN_EMAIL            = 'randrianomenjanaharyjacquinot@gmail.com'
        CORS_ALLOWLIST         = 'http://localhost:3000,https://api-etokisana.tsirylab.com'
        FRONTEND_URL           = 'http://localhost:3000'
        SUPERADMIN_EMAIL       = 'superadmin@commercegestion.com'
        SUPERADMIN_PASSWORD    = 'SuperSecurePassword2026!'
    }

    stages {
        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $IMAGE_NAME:$IMAGE_TAG .'
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                sh '''
                export IMAGE_NAME=$IMAGE_NAME
                export IMAGE_TAG=$IMAGE_TAG
                docker compose down || true
                docker compose up -d
                '''
            }
        }

        stage('Cleanup Old Images') {
            steps {
                sh 'docker image prune -f'
            }
        }
    }

    post {
        success { echo 'Déploiement terminé avec succès.' }
        failure { echo 'Échec critique du déploiement.' }
        always { cleanWs() }
    }
}
