from django.urls import path
from .views import (
    PartnerOverviewView, PartnerBusinessesView, PartnerBusinessStatusUpdateView,
    PartnerBusinessTariffUpdateView, CRMLeadsListView, CRMLeadDetailView,
    CRMLeadStageUpdateView, CRMLeadConvertView, PartnerCommissionsView,
    PartnerReportsView, PartnerReportDraftView, PartnerKPIsView, PartnerTeamUsersView
)

urlpatterns = [
    path('partner/overview', PartnerOverviewView.as_view(), name='partner-overview'),
    path('partner/businesses', PartnerBusinessesView.as_view(), name='partner-businesses'),
    path('partner/businesses/<str:business_id>/status', PartnerBusinessStatusUpdateView.as_view(), name='partner-biz-status'),
    path('partner/businesses/<str:business_id>/tariff', PartnerBusinessTariffUpdateView.as_view(), name='partner-biz-tariff'),

    # CRM
    path('partner/crm/leads', CRMLeadsListView.as_view(), name='partner-crm-leads'),
    path('partner/crm/leads/<str:pk>', CRMLeadDetailView.as_view(), name='partner-crm-lead-detail'),
    path('partner/crm/leads/<str:pk>/stage', CRMLeadStageUpdateView.as_view(), name='partner-crm-lead-stage'),
    path('partner/crm/leads/<str:pk>/convert', CRMLeadConvertView.as_view(), name='partner-crm-lead-convert'),

    # Commissions & Reports
    path('partner/commissions', PartnerCommissionsView.as_view(), name='partner-commissions'),
    path('partner/reports', PartnerReportsView.as_view(), name='partner-reports'),
    path('partner/reports/generate-draft', PartnerReportDraftView.as_view(), name='partner-reports-draft'),
    path('partner/kpis', PartnerKPIsView.as_view(), name='partner-kpis'),
    path('partner/team-users', PartnerTeamUsersView.as_view(), name='partner-team-users'),
]
