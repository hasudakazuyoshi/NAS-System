FROM mysql:8.0

COPY my.cnf /etc/mysql/conf.d/my.cnf


# スローログディレクトリを作成
RUN mkdir -p /var/log/mysql && \
    chown mysql:mysql /var/log/mysql
