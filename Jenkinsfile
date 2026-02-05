pipeline {
    agent any

    environment {
        IMAGE_NAME = "api-etokisana"
        IMAGE_TAG  = "${BUILD_NUMBER}"
        CONTAINER  = "api-etokisana"

        PORT       = "4243"
        NODE_ENV   = "production"

        MONGO_URI  = credentials('MONGO_URI_ETOKISANA')
        JWT_SECRET = credentials('JWT_SECRET')
        JWT_EXPIRES = "7d"
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
                    -e JWT_EXPIRES=$JWT_EXPIRES \
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
