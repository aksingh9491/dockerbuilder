FROM centos:7
RUN yum install httpd -y \
    && systemctl start httpd.service \
    && systemctl enable httpd.service
COPY index.html /var/www/html
EXPOSE 80
CMD ["httpd","-D","FORGROUND"]